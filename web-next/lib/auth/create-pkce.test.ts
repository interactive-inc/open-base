import { describe, expect, test } from "vite-plus/test"
import { createPkce } from "@/lib/auth/create-pkce"

describe("createPkce", () => {
  test("RFC 7636 S256 verifierとchallengeを生成する", async () => {
    const pkce = await createPkce()
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pkce.verifier))
    const expectedChallenge = Buffer.from(digest).toString("base64url")

    expect(pkce.verifier).toMatch(/^[A-Za-z0-9._~-]{43,128}$/)
    expect(pkce.challenge).toBe(expectedChallenge)
    expect(pkce.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  test("要求ごとに異なるverifierを生成する", async () => {
    const first = await createPkce()
    const second = await createPkce()

    expect(first.verifier).not.toBe(second.verifier)
  })
})
