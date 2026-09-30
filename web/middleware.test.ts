import { NextRequest } from "next/server"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { middleware } from "@/middleware"

const mocks = vi.hoisted(() => ({ postRefreshToken: vi.fn() }))
vi.mock("@/lib/api/post-refresh-token", () => ({ postRefreshToken: mocks.postRefreshToken }))

afterEach(() => vi.clearAllMocks())

describe("session refresh middleware", () => {
  test("lets the local export Route Handler return the unauthenticated API response", async () => {
    const response = await middleware(
      new NextRequest(
        "https://app.base.localhost/admin/audit-events/export?from=2026-07-01T00%3A00%3A00Z&to=2026-07-02T00%3A00%3A00Z",
      ),
    )
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  test("keeps the current URL when no session or refresh token exists", async () => {
    const response = await middleware(
      new NextRequest("https://app.base.localhost/admin/audit-events"),
    )
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  test("does not turn an invalid refresh token on the export route into HTML navigation", async () => {
    mocks.postRefreshToken.mockResolvedValue(new Error("invalid refresh"))
    const request = new NextRequest("https://app.base.localhost/admin/audit-events/export")
    request.cookies.set("refresh_token", "fixture")
    const response = await middleware(request)
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(mocks.postRefreshToken).toHaveBeenCalledWith("fixture")
  })

  test("keeps the cookies a concurrent successful refresh may have set when this refresh fails", async () => {
    mocks.postRefreshToken.mockResolvedValue(new Error("already rotated"))
    const request = new NextRequest("https://app.base.localhost/employees")
    request.cookies.set("refresh_token", "rotated-by-another-request")

    const response = await middleware(request)

    const setCookies = response.headers.getSetCookie().join("\n")
    expect(setCookies).not.toContain("session=;")
    expect(setCookies).not.toContain("refresh_token=;")
    expect(response.cookies.get("refresh_backoff")?.value).toBe("1")
  })

  test("does not retry the refresh while the backoff cookie is present", async () => {
    const request = new NextRequest("https://app.base.localhost/employees")
    request.cookies.set("refresh_token", "fixture")
    request.cookies.set("refresh_backoff", "1")

    const response = await middleware(request)

    expect(mocks.postRefreshToken).not.toHaveBeenCalled()
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  test("injects a refreshed session into the same request without redirecting", async () => {
    mocks.postRefreshToken.mockResolvedValue({
      access_token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJFMDExIiwiZXhwIjo0MTAyNDQ0ODAwfQ.signature",
      refresh_token: "rotated-refresh-token",
    })
    const request = new NextRequest("https://app.base.localhost/employees?status=active")
    request.cookies.set("refresh_token", "fixture")

    const response = await middleware(request)

    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(response.headers.get("x-middleware-request-cookie")).toContain("session=")
    expect(response.cookies.get("session")?.value).toContain("eyJhbGciOiJIUzI1NiJ9")
    expect(response.cookies.get("refresh_token")?.value).toBe("rotated-refresh-token")
  })

  test("never hands one user's refreshed session to a concurrent request holding another token", async () => {
    mocks.postRefreshToken.mockImplementation(
      (refreshToken: string) =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                access_token: `access-for-${refreshToken}`,
                refresh_token: `rotated-${refreshToken}`,
              }),
            10,
          )
        }),
    )

    const requestA = new NextRequest("https://app.base.localhost/employees")
    requestA.cookies.set("refresh_token", "token-a")

    const requestB = new NextRequest("https://app.base.localhost/employees")
    requestB.cookies.set("refresh_token", "token-b")

    const responses = await Promise.all([middleware(requestA), middleware(requestB)])

    expect(responses[0].cookies.get("session")?.value).toBe("access-for-token-a")
    expect(responses[0].cookies.get("refresh_token")?.value).toBe("rotated-token-a")
    expect(responses[1].cookies.get("session")?.value).toBe("access-for-token-b")
    expect(responses[1].cookies.get("refresh_token")?.value).toBe("rotated-token-b")
  })
})

describe("nonce-based CSP", () => {
  test("authenticated page response contains nonce and strict-dynamic in CSP", async () => {
    const request = new NextRequest("https://app.base.localhost/employees")
    request.cookies.set("session", "valid-token")
    const response = await middleware(request)

    const csp = response.headers.get("content-security-policy")
    expect(csp).not.toBeNull()
    expect(csp).toMatch(/'nonce-[0-9a-f-]+'/)
    expect(csp).toContain("'strict-dynamic'")
  })

  test("CSP nonce differs between requests", async () => {
    const req1 = new NextRequest("https://app.base.localhost/employees")
    req1.cookies.set("session", "valid-token")
    const res1 = await middleware(req1)

    const req2 = new NextRequest("https://app.base.localhost/employees")
    req2.cookies.set("session", "valid-token")
    const res2 = await middleware(req2)

    const nonce1 = res1.headers.get("content-security-policy")!.match(/'nonce-([^']+)'/)![1]
    const nonce2 = res2.headers.get("content-security-policy")!.match(/'nonce-([^']+)'/)![1]
    expect(nonce1).not.toBe(nonce2)
  })

  test("x-nonce request header is forwarded via x-middleware-request-x-nonce", async () => {
    const request = new NextRequest("https://app.base.localhost/employees")
    request.cookies.set("session", "valid-token")
    const response = await middleware(request)

    const overrideHeaders = response.headers.get("x-middleware-override-headers")
    expect(overrideHeaders).toContain("x-nonce")
    expect(overrideHeaders).toContain("content-security-policy")

    const forwardedNonce = response.headers.get("x-middleware-request-x-nonce")
    expect(forwardedNonce).toMatch(/^[0-9a-f-]+$/)
  })

  test("CSP is set when no session or refresh token exists", async () => {
    const request = new NextRequest("https://app.base.localhost/admin/audit-events")
    const response = await middleware(request)

    const csp = response.headers.get("content-security-policy")
    expect(csp).not.toBeNull()
    expect(csp).toMatch(/'nonce-[0-9a-f-]+'/)
    expect(csp).toContain("'strict-dynamic'")
  })

  test("CSP is set after successful refresh on protected page", async () => {
    mocks.postRefreshToken.mockResolvedValue({
      access_token: "new-access",
      refresh_token: "new-refresh",
    })
    const request = new NextRequest("https://app.base.localhost/employees")
    request.cookies.set("refresh_token", "old-refresh")
    const response = await middleware(request)

    const csp = response.headers.get("content-security-policy")
    expect(csp).not.toBeNull()
    expect(csp).toMatch(/'nonce-[0-9a-f-]+'/)
    expect(csp).toContain("'strict-dynamic'")
  })

  test("dev mode adds unsafe-eval to script-src", async () => {
    vi.stubEnv("NODE_ENV", "development")
    try {
      const request = new NextRequest("https://app.base.localhost/employees")
      request.cookies.set("session", "valid-token")
      const response = await middleware(request)

      const csp = response.headers.get("content-security-policy")
      expect(csp).toContain("'unsafe-eval'")
    } finally {
      vi.unstubAllEnvs()
    }
  })

  test("production mode does not include unsafe-eval", async () => {
    vi.stubEnv("NODE_ENV", "production")
    try {
      const request = new NextRequest("https://app.base.localhost/employees")
      request.cookies.set("session", "valid-token")
      const response = await middleware(request)

      const csp = response.headers.get("content-security-policy")
      expect(csp).not.toContain("'unsafe-eval'")
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
