import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { exchangeIdentityCode } from "@/lib/auth/exchange-identity-code"

describe("exchangeIdentityCode", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test("codeとPKCE verifierをback-channelで交換する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id_token: "signed.identity.jwt" }))
    vi.stubGlobal("fetch", fetchMock)

    const token = await exchangeIdentityCode({
      code: "one-time-code",
      codeVerifier: "v".repeat(43),
      redirectUri: "https://app.example.com/auth/callback",
      issuer: "https://login.example.com",
    })

    expect(token).toBe("signed.identity.jwt")
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://login.example.com/token"),
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: "one-time-code",
          redirect_uri: "https://app.example.com/auth/callback",
          code_verifier: "v".repeat(43),
        }),
      }),
    )
  })

  test("非HTTPSの外部issuerを拒否する", async () => {
    const token = await exchangeIdentityCode({
      code: "one-time-code",
      codeVerifier: "v".repeat(43),
      redirectUri: "https://app.example.com/auth/callback",
      issuer: "http://login.example.com",
    })

    expect(token).toBeInstanceOf(Error)
  })

  test("HTTPでもloopback issuerは許可する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id_token: "local.jwt" })))

    const token = await exchangeIdentityCode({
      code: "one-time-code",
      codeVerifier: "v".repeat(43),
      redirectUri: "http://localhost:3000/auth/callback",
      issuer: "http://127.0.0.1:18790",
    })

    expect(token).toBe("local.jwt")
  })
})
