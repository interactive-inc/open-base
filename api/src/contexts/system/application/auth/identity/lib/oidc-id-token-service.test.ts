import { describe, expect, test } from "bun:test"
import { exportJWK, generateKeyPair, importJWK, jwtVerify } from "jose"
import { OidcIdTokenService } from "@/contexts/system/application/auth/identity/lib/oidc-id-token-service"
import { getOidcPublicKeys } from "@system/application/auth/identity/lib/get-oidc-public-keys"
import { parseOidcSigningKeys } from "@system/application/auth/identity/lib/parse-oidc-signing-keys"
import type { SystemClockContext } from "@system/configuration/system-context"

describe("OidcIdTokenService", () => {
  test("ES256でissuer・audience・nonceと許可scopeのclaimを署名する", async () => {
    const { privateKey } = await generateKeyPair("ES256", { extractable: true })
    const key = await exportJWK(privateKey)
    if (!key.x || !key.y || !key.d) {
      throw new Error("test_key_generation_failed")
    }

    const active = {
      kty: "EC",
      crv: "P-256",
      x: key.x,
      y: key.y,
      d: key.d,
      kid: "test-key-1",
      use: "sig",
      alg: "ES256",
    }
    const context: SystemClockContext = {
      var: { now: () => new Date("2026-07-29T00:00:00.000Z") },
    }
    const service = new OidcIdTokenService(context)
    const keys = parseOidcSigningKeys(JSON.stringify({ active, previous: [] }))
    if (keys instanceof Error) {
      throw keys
    }
    const token = await service.create({
      keys,
      issuer: "https://identity.example.test",
      clientId: "system-console",
      identity: {
        subject: "user-1",
        email: "user@example.com",
        emailVerified: true,
      },
      nonce: "nonce-with-enough-entropy",
      scope: ["openid", "profile", "email"],
    })
    if (token instanceof Error) {
      throw token
    }

    const publicJwk = getOidcPublicKeys(keys)[0]
    if (!publicJwk) {
      throw new Error("missing_public_key")
    }
    const publicKey = await importJWK(publicJwk, "ES256")
    const verified = await jwtVerify(token, publicKey, {
      issuer: "https://identity.example.test",
      audience: "system-console",
      currentDate: new Date("2026-07-29T00:01:00.000Z"),
      algorithms: ["ES256"],
    })

    expect(verified.protectedHeader).toMatchObject({ alg: "ES256", kid: "test-key-1" })
    expect(verified.payload).toMatchObject({
      sub: "user-1",
      nonce: "nonce-with-enough-entropy",
      email: "user@example.com",
      email_verified: true,
    })
    expect(verified.payload).not.toHaveProperty("name")
  })
})
