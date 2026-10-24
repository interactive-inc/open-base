import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { ConsumeOidcAuthorizationCodeAdapter } from "@system/infrastructure/adapters/identity/consume-oidc-authorization-code.adapter"
import { CreateOidcAuthorizationCodeAdapter } from "@system/infrastructure/adapters/identity/create-oidc-authorization-code.adapter"
import { toPkceS256Challenge } from "@system/lib/auth/to-pkce-s256-challenge"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

describe("consumeOidcAuthorizationCode", () => {
  test("誤ったverifier・issuer・client・redirect URIでは消費しない", async () => {
    const fixture = await SystemSessionTestContext.create()
    const now = new Date("2026-01-01T00:00:00.000Z")
    const accountId = zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e")
    await execSql(
      fixture.database,
      "INSERT INTO system_accounts (id, status, token_version, closed_at, created_at, updated_at) VALUES ('d5858208-e680-4db8-a05d-8bf4f900c24e', 'active', 0, NULL, 0, 0)",
    )
    const context = {
      var: {
        database: drizzle(fixture.context.env.DB, { schema: systemCoreSchema }),
        now: () => now,
      },
    }
    const issued = await new CreateOidcAuthorizationCodeAdapter(
      context,
    ).createOidcAuthorizationCode({
      issuer: "https://identity.example.test",
      clientId: "system-console",
      redirectUri: "https://console.example.test/callback",
      accountId,
      codeChallenge: await toPkceS256Challenge(verifier),
      nonce: "nonce-with-enough-entropy",
      scope: ["openid"],
    })

    if (issued instanceof Error) throw issued
    const valid = {
      issuer: "https://identity.example.test",
      clientId: "system-console",
      redirectUri: "https://console.example.test/callback",
      code: issued.code,
      verifier,
    }

    expect(
      await new ConsumeOidcAuthorizationCodeAdapter(context).consumeOidcAuthorizationCode({
        ...valid,
        verifier: `${verifier.slice(0, -1)}A`,
      }),
    ).toBeNull()
    expect(
      await new ConsumeOidcAuthorizationCodeAdapter(context).consumeOidcAuthorizationCode({
        ...valid,
        issuer: "https://secondary.identity.example.test",
      }),
    ).toBeNull()
    expect(
      await new ConsumeOidcAuthorizationCodeAdapter(context).consumeOidcAuthorizationCode({
        ...valid,
        clientId: "other-client",
      }),
    ).toBeNull()
    expect(
      await new ConsumeOidcAuthorizationCodeAdapter(context).consumeOidcAuthorizationCode({
        ...valid,
        redirectUri: "https://attacker.example.test/callback",
      }),
    ).toBeNull()
    expect(
      await new ConsumeOidcAuthorizationCodeAdapter(context).consumeOidcAuthorizationCode(valid),
    ).toEqual({
      accountId,
      nonce: "nonce-with-enough-entropy",
      scope: "openid",
    })
    expect(
      await new ConsumeOidcAuthorizationCodeAdapter(context).consumeOidcAuthorizationCode(valid),
    ).toBeNull()
  })

  test("期限切れcodeを消費しない", async () => {
    const fixture = await SystemSessionTestContext.create()
    const issuedAt = new Date("2026-01-01T00:00:00.000Z")
    const accountId = zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e")
    await execSql(
      fixture.database,
      "INSERT INTO system_accounts (id, status, token_version, closed_at, created_at, updated_at) VALUES ('d5858208-e680-4db8-a05d-8bf4f900c24e', 'active', 0, NULL, 0, 0)",
    )
    const database = drizzle(fixture.context.env.DB, { schema: systemCoreSchema })
    const issued = await new CreateOidcAuthorizationCodeAdapter({
      var: { database, now: () => issuedAt },
    }).createOidcAuthorizationCode({
      issuer: "https://identity.example.test",
      clientId: "system-console",
      redirectUri: "https://console.example.test/callback",
      accountId,
      codeChallenge: await toPkceS256Challenge(verifier),
      nonce: "nonce-with-enough-entropy",
      scope: ["openid"],
    })

    if (issued instanceof Error) throw issued
    expect(
      await new ConsumeOidcAuthorizationCodeAdapter({
        var: { database, now: () => new Date("2026-01-01T00:02:00.000Z") },
      }).consumeOidcAuthorizationCode({
        issuer: "https://identity.example.test",
        clientId: "system-console",
        redirectUri: "https://console.example.test/callback",
        code: issued.code,
        verifier,
      }),
    ).toBeNull()
  })

  test("PKCE条件を満たす並行交換を一件だけ成功させる", async () => {
    const fixture = await SystemSessionTestContext.create()
    const now = new Date("2026-01-01T00:00:00.000Z")
    const accountId = zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e")
    await execSql(
      fixture.database,
      "INSERT INTO system_accounts (id, status, token_version, closed_at, created_at, updated_at) VALUES ('d5858208-e680-4db8-a05d-8bf4f900c24e', 'active', 0, NULL, 0, 0)",
    )
    const context = {
      var: {
        database: drizzle(fixture.context.env.DB, { schema: systemCoreSchema }),
        now: () => now,
      },
    }
    const issued = await new CreateOidcAuthorizationCodeAdapter(
      context,
    ).createOidcAuthorizationCode({
      issuer: "https://identity.example.test",
      clientId: "system-console",
      redirectUri: "https://console.example.test/callback",
      accountId,
      codeChallenge: await toPkceS256Challenge(verifier),
      nonce: "nonce-with-enough-entropy",
      scope: ["openid", "email"],
    })

    if (issued instanceof Error) throw issued
    const props = {
      issuer: "https://identity.example.test",
      clientId: "system-console",
      redirectUri: "https://console.example.test/callback",
      code: issued.code,
      verifier,
    }
    const consumed = await Promise.all(
      Array.from({ length: 8 }, () =>
        new ConsumeOidcAuthorizationCodeAdapter(context).consumeOidcAuthorizationCode(props),
      ),
    )

    expect(consumed.filter((result) => result !== null && !(result instanceof Error))).toEqual([
      {
        accountId,
        nonce: "nonce-with-enough-entropy",
        scope: "openid email",
      },
    ])
  })
})
