import { describe, expect, test } from "bun:test"
import { createSystemIdentityTestKey } from "@system/test/create-system-identity-test-key.test-support"
import { createSystemIdentityToken } from "@system/test/create-system-identity-token.test-support"
import { SystemIdentityTokenVerifier } from "@system/lib/auth/system-identity-token-verifier"

const identityKey = await createSystemIdentityTestKey()
const wrongIdentityKey = await createSystemIdentityTestKey("wrong-key")
const issuer = "https://identity-provider.example/"
const audience = "urn:system:identity-login"
const nowEpoch = 1_767_225_600
const now = new Date(nowEpoch * 1_000)

describe("SystemIdentityTokenVerifier", () => {
  test("accepts a valid EdDSA token and returns its claims", async () => {
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "ext-1",
      jti: "jti-1",
      audience,
    })

    const claims = await new SystemIdentityTokenVerifier().verify({
      token,
      verificationKey: identityKey.verificationKey,
      issuer,
      audience,
      now,
    })

    if ("reason" in claims) throw new Error("expected valid claims")
    expect(String(claims.sub)).toBe("ext-1")
    expect(claims.email).toBe("you+ext@example.com")
    expect(claims.email_verified).toBe(true)
    expect(claims.name).toBe("External Worker")
    expect(claims.jti).toBe("jti-1")
  })

  test("rejects a token signed with a key outside the JWKS", async () => {
    const token = await createSystemIdentityToken(wrongIdentityKey.signingKey, nowEpoch, {
      keyId: wrongIdentityKey.keyId,
      audience,
    })

    expect(
      await new SystemIdentityTokenVerifier().verify({
        token,
        verificationKey: identityKey.verificationKey,
        issuer,
        audience,
        now,
      }),
    ).toEqual({ reason: "invalid_token" })
  })

  test("rejects a token with an unexpected issuer", async () => {
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      issuer: "https://attacker.example/",
      audience,
    })

    expect(
      await new SystemIdentityTokenVerifier().verify({
        token,
        verificationKey: identityKey.verificationKey,
        issuer,
        audience,
        now,
      }),
    ).toEqual({ reason: "invalid_token" })
  })

  test("rejects a token with an unexpected audience", async () => {
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      audience: "some-other-app",
    })

    expect(
      await new SystemIdentityTokenVerifier().verify({
        token,
        verificationKey: identityKey.verificationKey,
        issuer,
        audience,
        now,
      }),
    ).toEqual({ reason: "invalid_token" })
  })

  test("rejects an expired token", async () => {
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch - 120, {
      exp: nowEpoch - 60,
      iat: nowEpoch - 120,
      audience,
    })

    expect(
      await new SystemIdentityTokenVerifier().verify({
        token,
        verificationKey: identityKey.verificationKey,
        issuer,
        audience,
        now,
      }),
    ).toEqual({ reason: "invalid_token" })
  })

  test("rejects a token missing required claims", async () => {
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      jti: "",
      audience,
    })

    expect(
      await new SystemIdentityTokenVerifier().verify({
        token,
        verificationKey: identityKey.verificationKey,
        issuer,
        audience,
        now,
      }),
    ).toEqual({ reason: "invalid_token" })
  })
})
