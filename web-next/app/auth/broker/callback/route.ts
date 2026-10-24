import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { issueExternalIdentityStepUpGrant } from "@/lib/api/issue-external-identity-step-up-grant"
import { postIdentityLogin } from "@/lib/api/post-identity-login"
import { setSessionCookies } from "@/lib/auth/set-session-cookies"
import { exchangeIdentityCode } from "@/lib/auth/exchange-identity-code"
import { identityLoginCookieNames } from "@/lib/auth/identity-login-cookie-names"
import { isSecureIdentityIssuer } from "@/lib/auth/is-secure-identity-issuer"
import { resolveStepUpReturnPath } from "@/lib/auth/resolve-step-up-return-path"
import { setStepUpCookie } from "@/lib/auth/set-step-up-cookie"
import { stepUpCookieMaxAge } from "@/lib/auth/step-up-cookie-max-age"

/**
 * 外部 identity provider（SSO ブローカー）からの戻り先。
 * queryのone-time codeをHTTP-only CookieのPKCE verifierで交換する。
 * identity JWTはバックチャネルだけで受け取り、URLやクライアントJSへ渡さない。
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const redirectUri = process.env.IDENTITY_REDIRECT_URI
  const issuer = process.env.IDENTITY_LOGIN_URL
  if (!redirectUri || !issuer) {
    return redirectToError(request, "login_not_configured")
  }
  try {
    if (!isSecureIdentityIssuer(new URL(redirectUri)) || !isSecureIdentityIssuer(new URL(issuer))) {
      return redirectToError(request, "login_not_configured")
    }
  } catch {
    return redirectToError(request, "login_not_configured")
  }

  const state = request.nextUrl.searchParams.get("state")
  if (
    !state ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(state)
  ) {
    return redirectToError(request, "invalid_state")
  }

  const names = identityLoginCookieNames(redirectUri, state)
  const expectedState = request.cookies.get(names.state)?.value ?? null
  const codeVerifier = request.cookies.get(names.verifier)?.value ?? null
  const code = request.nextUrl.searchParams.get("code")
  const brokerError = request.nextUrl.searchParams.get("error")

  if (brokerError !== null) {
    return clearIdentityCookies(redirectToError(request, brokerError), names)
  }

  if (!code || !expectedState || !codeVerifier || state !== expectedState) {
    return clearIdentityCookies(redirectToError(request, "invalid_state"), names)
  }

  const token = await exchangeIdentityCode({ code, codeVerifier, redirectUri, issuer })
  if (token instanceof Error) {
    return clearIdentityCookies(redirectToError(request, "login_failed"), names)
  }

  // 再認証として始めたときは、ログインし直さず現在のsessionへ再認証grantを発行する。
  const stepUpReturn = request.cookies.get(names.stepUpReturn)?.value ?? null
  if (stepUpReturn !== null) {
    const grant = await issueExternalIdentityStepUpGrant(token)
    const maxAge = grant instanceof Error ? null : stepUpCookieMaxAge(grant.expiresAt, new Date())
    if (grant instanceof Error || maxAge === null) {
      return clearIdentityCookies(redirectToError(request, "step_up_failed"), names)
    }
    const returnPath = resolveStepUpReturnPath(stepUpReturn) ?? "/"
    const response = NextResponse.redirect(new URL(returnPath, requestOrigin(request)))
    setStepUpCookie({ cookieStore: response.cookies, stepUpToken: grant.stepUpToken, maxAge })

    return clearIdentityCookies(response, names)
  }

  const loginResult = await postIdentityLogin({ token })

  if (loginResult instanceof Error) {
    const reason =
      loginResult.message === "account_not_found" ? "account_not_found" : "login_failed"

    return clearIdentityCookies(redirectToError(request, reason), names)
  }

  const response = NextResponse.redirect(new URL("/", requestOrigin(request)))

  setSessionCookies({
    cookieStore: response.cookies,
    accessToken: loginResult.access_token,
    refreshToken: loginResult.refresh_token,
  })
  clearIdentityCookies(response, names)

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

function clearIdentityCookies(
  response: NextResponse,
  names: ReturnType<typeof identityLoginCookieNames>,
): NextResponse {
  const secure = names.state.startsWith("__Host-")
  response.cookies.set(names.state, "", {
    expires: new Date(0),
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  })
  response.cookies.set(names.verifier, "", {
    expires: new Date(0),
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  })
  response.cookies.set(names.stepUpReturn, "", {
    expires: new Date(0),
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  })
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("Referrer-Policy", "no-referrer")

  return response
}
