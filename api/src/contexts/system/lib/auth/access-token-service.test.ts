import { AccessTokenService, type AccessTokenProfile } from "@system/lib/auth/access-token-service"
import { describe, expect, test } from "bun:test"

const secret = "shared-test-secret"
const now = new Date("2026-01-01T00:00:00.000Z")
const profile = Object.freeze({
  issuer: "system-test",
  audience: "system-test-api",
  purpose: "api-session",
  maxAgeSeconds: 60,
}) satisfies AccessTokenProfile

describe("AccessTokenService", () => {
  test("機械credentialの来歴を署名し、web・mobile用途への混入を拒否する", async () => {
    const input = {
      accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
      tokenVersion: 0,
      machineCredentialId: "ad6a0f96-902f-4999-84f6-2b9eb703c2ed",
    }
    const service = new AccessTokenService({ profile })
    const token = await service.create(input, secret, now)
    if (token instanceof Error) throw token
    expect(await service.verify(token, secret, now)).toMatchObject({
      machineCredentialId: "ad6a0f96-902f-4999-84f6-2b9eb703c2ed",
    })
    for (const purpose of ["web-session", "mobile-session"] satisfies Array<
      AccessTokenProfile["purpose"]
    >) {
      expect(
        await new AccessTokenService({ profile: { ...profile, purpose } }).create(
          input,
          secret,
          now,
        ),
      ).toBeInstanceOf(Error)
    }
  })

  test("Accountだけを主体にして固定profileの短命tokenを往復する", async () => {
    const service = new AccessTokenService({ profile })
    const token = await service.create(
      { accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e", tokenVersion: 7 },
      secret,
      now,
    )
    expect(token).not.toBeInstanceOf(Error)
    if (token instanceof Error) return

    const claims = await service.verify(token, secret, now)
    expect(claims).not.toBeInstanceOf(Error)
    if (claims instanceof Error) return

    expect(String(claims.sub)).toBe("d5858208-e680-4db8-a05d-8bf4f900c24e")
    expect(claims.ver).toBe(7)
    expect(claims.iss).toBe(profile.issuer)
    expect(claims.aud).toBe(profile.audience)
    expect(claims.purpose).toBe(profile.purpose)
    expect(claims.exp - claims.iat).toBe(profile.maxAgeSeconds)
    expect(claims.jti).toBeString()
    expect(Object.keys(claims).sort()).toEqual(
      ["aud", "exp", "iat", "iss", "issuedAtMs", "jti", "purpose", "sub", "ver"].sort(),
    )
  })

  test("issuer・audience・purpose・最大寿命が違うprofile間ではtokenを流用できない", async () => {
    const source = new AccessTokenService({
      profile: { ...profile, maxAgeSeconds: 120 },
    })
    const token = await source.create(
      { accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e", tokenVersion: 0 },
      secret,
      now,
    )
    expect(token).not.toBeInstanceOf(Error)
    if (token instanceof Error) return

    const services = [
      new AccessTokenService({ profile }),
      new AccessTokenService({
        profile: { ...profile, issuer: "another-system", maxAgeSeconds: 120 },
      }),
      new AccessTokenService({
        profile: { ...profile, audience: "another-api", maxAgeSeconds: 120 },
      }),
      new AccessTokenService({
        profile: { ...profile, purpose: "web-session", maxAgeSeconds: 120 },
      }),
    ]

    for (const service of services) {
      expect(await service.verify(token, secret, now)).toBeInstanceOf(Error)
    }
  })

  test("空のsecretと不正なprofileをfail closedで拒否する", async () => {
    expect(
      await new AccessTokenService({ profile }).create(
        { accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e", tokenVersion: 0 },
        "",
        now,
      ),
    ).toBeInstanceOf(Error)
    expect(
      await new AccessTokenService({
        profile: { ...profile, maxAgeSeconds: 0 },
      }).create(
        { accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e", tokenVersion: 0 },
        secret,
        now,
      ),
    ).toBeInstanceOf(Error)
  })

  test("共通opaque ID契約の範囲外にあるAccount IDを拒否する", async () => {
    expect(
      await new AccessTokenService({ profile }).create(
        { accountId: "a".repeat(256), tokenVersion: 0 },
        secret,
        now,
      ),
    ).toBeInstanceOf(Error)
  })
})
