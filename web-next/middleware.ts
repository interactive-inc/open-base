import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { postRefreshToken } from "@/lib/api/post-refresh-token"
import { setSessionCookies } from "@/lib/auth/set-session-cookies"

/** 更新に失敗した後、同じ refresh token での再試行を止める cookie と期間。 */
const REFRESH_BACKOFF_COOKIE = "refresh_backoff"
const REFRESH_BACKOFF_SECONDS = 60

export const config = {
  matcher: ["/((?!monitoring|_next/static|_next/image|favicon.ico).*)"],
}

/**
 * refresh token ごとの実行中 rotation。同じ token を提示した並行リクエストだけを束ね、
 * reuse detection による自己 DoS を防ぐ。
 *
 * キーは必ず refresh token 自身にする。module 全域変数は同一 isolate の全リクエストで
 * 共有されるため、token を跨いで 1 本の Promise を配ると別ユーザーのセッションが
 * 発行される。
 */
const inflightRefreshes = new Map<string, Promise<Awaited<ReturnType<typeof postRefreshToken>>>>()

function deduplicatedRefresh(
  refreshToken: string,
): Promise<Awaited<ReturnType<typeof postRefreshToken>>> {
  const inflight = inflightRefreshes.get(refreshToken)

  if (inflight !== undefined) {
    return inflight
  }

  const started = postRefreshToken(refreshToken).finally(() => {
    inflightRefreshes.delete(refreshToken)
  })

  inflightRefreshes.set(refreshToken, started)

  return started
}

/**
 * Build a Content-Security-Policy value with a per-request nonce.
 *
 * In development Turbopack uses eval, so 'unsafe-eval' is added to script-src.
 * 'strict-dynamic' propagates trust from the nonced bootstrap script to dynamically
 * loaded chunks, so explicit host allowlists are unnecessary.
 */
function buildCsp(nonce: string): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(process.env.NODE_ENV === "development" ? ["'unsafe-eval'"] : []),
  ].join(" ")

  // base-uri と form-action は default-src にフォールバックしないため個別に閉じる。
  // 未指定だと HTML 混入時に <base href> でスクリプトの取得元をすり替えられ、
  // フォームの送信先を外部へ向けられる。
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ")
}

/**
 * Create a NextResponse.next() with the nonce-based CSP set on both the
 * forwarded request headers (so Next.js can read the nonce and stamp inline
 * scripts) and the response headers (so the browser enforces the policy).
 */
function nextWithCsp(request: NextRequest, nonce: string, csp: string): NextResponse {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("content-security-policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("content-security-policy", csp)

  return response
}

/**
 * access token cookie が無い場合は refresh token を1回だけローテーションし、
 * 新しい session を同じ URL のリクエストへ注入する。
 * 認証できない場合もリダイレクトせず、API の AuthError を error boundary まで伝播させる。
 * Next 16 の proxy.ts(Node runtime)は OpenNext Cloudflare 未対応のため、
 * Edge で動く middleware.ts 記法を維持する。
 *
 * Every page-rendering response carries a per-request nonce-based CSP so that
 * Next.js can stamp its inline scripts while the browser blocks un-nonced ones.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const nonce = crypto.randomUUID()
  const csp = buildCsp(nonce)

  const sessionCookie = request.cookies.get("session")

  const refreshTokenCookie = request.cookies.get("refresh_token")

  if (sessionCookie !== undefined) {
    return nextWithCsp(request, nonce, csp)
  }

  if (refreshTokenCookie === undefined) {
    return nextWithCsp(request, nonce, csp)
  }

  // 直前の更新に失敗した後は、しばらく同じ token で更新を試さない。
  if (request.cookies.get(REFRESH_BACKOFF_COOKIE) !== undefined) {
    return nextWithCsp(request, nonce, csp)
  }

  const refreshed = await deduplicatedRefresh(refreshTokenCookie.value)

  if (refreshed instanceof Error) {
    const response = nextWithCsp(request, nonce, csp)

    // 同じ token で並行した別のリクエストが先に更新を済ませていることがある。その応答が置いた
    // 新しい cookie を消すとログアウトさせてしまうので、ここでは cookie を消さず、短い間だけ
    // 更新を止める。本当に無効な token なら、ログインのやり直しで cookie が置き換わる。
    response.cookies.set(REFRESH_BACKOFF_COOKIE, "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_BACKOFF_SECONDS,
    })

    return response
  }

  request.cookies.set("session", refreshed.access_token)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("content-security-policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("content-security-policy", csp)

  setSessionCookies({
    cookieStore: response.cookies,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
  })
  response.cookies.delete(REFRESH_BACKOFF_COOKIE)

  return response
}
