import { NextRequest } from "next/server"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { GET } from "@/app/auth/broker/callback/route"
import { identityLoginCookieNames } from "@/lib/auth/identity-login-cookie-names"

const mocks = vi.hoisted(() => ({
  exchangeIdentityCode: vi.fn(),
  postIdentityLogin: vi.fn(),
  setSessionCookies: vi.fn(),
  issueExternalIdentityStepUpGrant: vi.fn(),
}))

vi.mock("@/lib/auth/exchange-identity-code", () => ({
  exchangeIdentityCode: mocks.exchangeIdentityCode,
}))
vi.mock("@/lib/api/post-identity-login", () => ({
  postIdentityLogin: mocks.postIdentityLogin,
}))
vi.mock("@/lib/api/issue-external-identity-step-up-grant", () => ({
  issueExternalIdentityStepUpGrant: mocks.issueExternalIdentityStepUpGrant,
}))
vi.mock("@/lib/auth/set-session-cookies", () => ({
  setSessionCookies: mocks.setSessionCookies,
}))

const redirectUri = "https://app.example.com/auth/broker/callback"
const issuer = "https://login.example.com"
const state = "f3c9d28e-7b50-4ef1-a5e4-20d4538f06ad"
const verifier = "v".repeat(43)
const originalIdentityLoginUrl = process.env.IDENTITY_LOGIN_URL
const originalIdentityRedirectUri = process.env.IDENTITY_REDIRECT_URI

afterEach(() => {
  if (originalIdentityLoginUrl === undefined) {
    delete process.env.IDENTITY_LOGIN_URL
  } else {
    process.env.IDENTITY_LOGIN_URL = originalIdentityLoginUrl
  }
  if (originalIdentityRedirectUri === undefined) {
    delete process.env.IDENTITY_REDIRECT_URI
  } else {
    process.env.IDENTITY_REDIRECT_URI = originalIdentityRedirectUri
  }
  vi.clearAllMocks()
})

describe("GET /auth/broker/callback", () => {
  test("state専用Cookieを照合しcodeをserver-sideで交換する", async () => {
    process.env.IDENTITY_LOGIN_URL = issuer
    process.env.IDENTITY_REDIRECT_URI = redirectUri
    mocks.exchangeIdentityCode.mockResolvedValue("signed.identity.jwt")
    mocks.postIdentityLogin.mockResolvedValue({
      access_token: "access-token",
      refresh_token: "refresh-token",
    })
    const names = identityLoginCookieNames(redirectUri, state)
    const request = new NextRequest(
      `https://app.example.com/auth/broker/callback?code=one-time-code&state=${state}`,
    )
    request.cookies.set(names.state, state)
    request.cookies.set(names.verifier, verifier)
    expect(request.nextUrl.searchParams.get("state")).toBe(state)
    expect(request.cookies.get(names.state)?.value).toBe(state)
    expect(request.cookies.get(names.verifier)?.value).toBe(verifier)

    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get("Location")).toBe("https://app.example.com/")
    expect(mocks.exchangeIdentityCode).toHaveBeenCalledWith({
      code: "one-time-code",
      codeVerifier: verifier,
      redirectUri,
      issuer,
    })
    expect(mocks.postIdentityLogin).toHaveBeenCalledWith({ token: "signed.identity.jwt" })
    expect(mocks.setSessionCookies).toHaveBeenCalledOnce()
    expect(response.headers.get("Cache-Control")).toBe("no-store")

    const clearedCookies = response.headers.getSetCookie().join("\n")
    expect(clearedCookies).toContain(`${names.state}=`)
    expect(clearedCookies).toContain(`${names.verifier}=`)
    expect(clearedCookies).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT")
    expect(clearedCookies).toContain("Secure")
  })

  test("Cookieと一致しないstateではcodeを交換しない", async () => {
    process.env.IDENTITY_LOGIN_URL = issuer
    process.env.IDENTITY_REDIRECT_URI = redirectUri
    const names = identityLoginCookieNames(redirectUri, state)
    const request = new NextRequest(
      `https://app.example.com/auth/broker/callback?code=one-time-code&state=${state}`,
    )
    request.cookies.set(names.state, "different")
    request.cookies.set(names.verifier, verifier)

    const response = await GET(request)

    expect(response.headers.get("Location")).toContain("/auth/broker/error?reason=invalid_state")
    expect(mocks.exchangeIdentityCode).not.toHaveBeenCalled()
  })

  test("UUIDでないstateをCookie名に使わない", async () => {
    process.env.IDENTITY_LOGIN_URL = issuer
    process.env.IDENTITY_REDIRECT_URI = redirectUri
    const request = new NextRequest(
      "https://app.example.com/auth/broker/callback?code=one-time-code&state=../../invalid",
    )

    const response = await GET(request)

    expect(response.headers.get("Location")).toContain("/auth/broker/error?reason=invalid_state")
    expect(mocks.exchangeIdentityCode).not.toHaveBeenCalled()
  })

  test("再認証として始めたときはログインし直さず再認証 grant を置いて元の画面へ戻す", async () => {
    process.env.IDENTITY_LOGIN_URL = issuer
    process.env.IDENTITY_REDIRECT_URI = redirectUri
    mocks.exchangeIdentityCode.mockResolvedValue("signed.identity.jwt")
    mocks.issueExternalIdentityStepUpGrant.mockResolvedValue({
      stepUpToken: "step-up-token",
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    })
    const names = identityLoginCookieNames(redirectUri, state)
    const request = new NextRequest(
      `https://app.example.com/auth/broker/callback?code=one-time-code&state=${state}`,
    )
    request.cookies.set(names.state, state)
    request.cookies.set(names.verifier, verifier)
    request.cookies.set(names.stepUpReturn, "/system/roles")

    const response = await GET(request)

    expect(response.headers.get("Location")).toBe("https://app.example.com/system/roles")
    expect(mocks.issueExternalIdentityStepUpGrant).toHaveBeenCalledWith("signed.identity.jwt")
    expect(mocks.postIdentityLogin).not.toHaveBeenCalled()
    expect(mocks.setSessionCookies).not.toHaveBeenCalled()
    expect(response.cookies.get("step_up")?.value).toBe("step-up-token")
    expect(response.headers.get("Set-Cookie")).toContain(`${names.stepUpReturn}=`)
  })

  test("再認証 grant を発行できなければ session を変えずに失敗を案内する", async () => {
    process.env.IDENTITY_LOGIN_URL = issuer
    process.env.IDENTITY_REDIRECT_URI = redirectUri
    mocks.exchangeIdentityCode.mockResolvedValue("signed.identity.jwt")
    mocks.issueExternalIdentityStepUpGrant.mockResolvedValue(new Error("invalid_credentials"))
    const names = identityLoginCookieNames(redirectUri, state)
    const request = new NextRequest(
      `https://app.example.com/auth/broker/callback?code=one-time-code&state=${state}`,
    )
    request.cookies.set(names.state, state)
    request.cookies.set(names.verifier, verifier)
    request.cookies.set(names.stepUpReturn, "/system/roles")

    const response = await GET(request)

    expect(response.headers.get("Location")).toContain("/auth/broker/error?reason=step_up_failed")
    expect(mocks.postIdentityLogin).not.toHaveBeenCalled()
    expect(response.cookies.get("step_up")).toBeUndefined()
  })
})
