import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { postBrowserToken } from "@/lib/api/post-browser-token"
import { setSessionCookies } from "@/lib/auth/set-session-cookies"

/**
 * 認証済みの CLI がブラウザへセッションを受け渡す戻り先。
 * query の code をサーバーサイドで api に渡して交換し、session cookie を立てて
 * トップへリダイレクトする。code はここで使い切り（60 秒・一回限り）、
 * クライアント JS には渡さない。リダイレクトで URL からも消える。
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code")

  if (code === null || code === "") {
    return redirectToError(request, "login_failed")
  }

  const loginResult = await postBrowserToken({ code })

  if (loginResult instanceof Error) {
    return redirectToError(request, "login_failed")
  }

  const response = NextResponse.redirect(new URL("/", requestOrigin(request)))

  setSessionCookies({
    cookieStore: response.cookies,
    accessToken: loginResult.access_token,
    refreshToken: loginResult.refresh_token,
  })

  return response
}

/**
 * リバースプロキシ背後では nextUrl.origin が内部ポートを指すため、
 * x-forwarded-host / x-forwarded-proto を優先して外向きの origin を組み立てる
 */
function requestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host")

  if (forwardedHost === null) {
    return request.nextUrl.origin
  }

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https"

  return `${forwardedProto}://${forwardedHost}`
}

function redirectToError(request: NextRequest, reason: string): NextResponse {
  const url = new URL("/auth/broker/error", requestOrigin(request))
  url.searchParams.set("reason", reason)

  return NextResponse.redirect(url)
}
