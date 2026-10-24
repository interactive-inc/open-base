import { NextRequest } from "next/server"
import { afterEach, describe, expect, test } from "vite-plus/test"
import { GET } from "@/app/auth/broker/login/route"
import { identityLoginCookieNames } from "@/lib/auth/identity-login-cookie-names"

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
})

describe("GET /auth/broker/login", () => {
  test("stateとPKCEを生成しstate専用HttpOnly Cookieを設定する", async () => {
    process.env.IDENTITY_LOGIN_URL = "https://login.example.com"
    process.env.IDENTITY_REDIRECT_URI = "https://app.example.com/auth/broker/callback"

    const response = await GET()
    const location = response.headers.get("Location")
    expect(location).not.toBeNull()
    if (location === null) {
      return
    }

    const brokerUrl = new URL(location)
    const state = brokerUrl.searchParams.get("state")
    expect(state).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    expect(brokerUrl.searchParams.get("callback")).toBe(
      "https://app.example.com/auth/broker/callback",
    )
    expect(brokerUrl.searchParams.get("code_challenge_method")).toBe("S256")
    expect(brokerUrl.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(brokerUrl.searchParams.get("code_verifier")).toBeNull()

    const cookies = response.headers.getSetCookie().join("\n")
    expect(cookies).toContain(`__Host-identity_login_state_${state}=`)
    expect(cookies).toContain(`__Host-identity_login_verifier_${state}=`)
    expect(cookies).toContain("HttpOnly")
    expect(cookies).toContain("Secure")
    expect(cookies).toContain("SameSite=lax")
    expect(cookies).toContain("Path=/")
  })

  test("並行したログインで異なるstate専用Cookieを発行する", async () => {
    process.env.IDENTITY_LOGIN_URL = "https://login.example.com"
    process.env.IDENTITY_REDIRECT_URI = "https://app.example.com/auth/broker/callback"

    const first = await GET()
    const second = await GET()

    expect(first.headers.get("Location")).not.toBe(second.headers.get("Location"))
    expect(first.headers.getSetCookie()).not.toEqual(second.headers.getSetCookie())
  })

  test("外部HTTP brokerを拒否する", async () => {
    process.env.IDENTITY_LOGIN_URL = "http://login.example.com"
    process.env.IDENTITY_REDIRECT_URI = "https://app.example.com/auth/broker/callback"

    const response = await GET()

    expect(response.status).toBe(503)
  })

  test("再認証として始めると、同じ origin の戻り先だけを state 専用 Cookie に置く", async () => {
    const redirectUri = "https://app.example.com/auth/broker/callback"
    process.env.IDENTITY_LOGIN_URL = "https://login.example.com"
    process.env.IDENTITY_REDIRECT_URI = redirectUri

    for (const [returnTo, expected] of [
      ["/system/roles", "/system/roles"],
      ["https://evil.example.com", "/"],
    ] as const) {
      const response = await GET(
        new NextRequest(
          `https://app.example.com/auth/broker/login?purpose=step-up&return_to=${encodeURIComponent(returnTo)}`,
        ),
      )
      const state = new URL(response.headers.get("Location") ?? "").searchParams.get("state") ?? ""
      const names = identityLoginCookieNames(redirectUri, state)
      expect(response.cookies.get(names.stepUpReturn)?.value).toBe(expected)
    }
  })

  test("通常のログインでは再認証の戻り先を置かない", async () => {
    const redirectUri = "https://app.example.com/auth/broker/callback"
    process.env.IDENTITY_LOGIN_URL = "https://login.example.com"
    process.env.IDENTITY_REDIRECT_URI = redirectUri

    const response = await GET(new NextRequest("https://app.example.com/auth/broker/login"))
    const state = new URL(response.headers.get("Location") ?? "").searchParams.get("state") ?? ""
    expect(
      response.cookies.get(identityLoginCookieNames(redirectUri, state).stepUpReturn),
    ).toBeUndefined()
  })
})
