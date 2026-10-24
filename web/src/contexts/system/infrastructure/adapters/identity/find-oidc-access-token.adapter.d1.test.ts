import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { CreateOidcAccessTokenAdapter } from "@system/infrastructure/adapters/identity/create-oidc-access-token.adapter"
import { FindOidcAccessTokenAdapter } from "@system/infrastructure/adapters/identity/find-oidc-access-token.adapter"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

describe("findOidcAccessToken", () => {
  test("issuerと有効期限が一致するtokenだけを返す", async () => {
    const fixture = await SystemSessionTestContext.create()
    const issuedAt = new Date("2026-01-01T00:00:00.000Z")
    const accountId = zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e")
    await execSql(
      fixture.database,
      "INSERT INTO system_accounts (id, status, token_version, closed_at, created_at, updated_at) VALUES ('d5858208-e680-4db8-a05d-8bf4f900c24e', 'active', 0, NULL, 0, 0)",
    )
    const database = drizzle(fixture.context.env.DB, { schema: systemCoreSchema })
    const issued = await new CreateOidcAccessTokenAdapter({
      var: { database, now: () => issuedAt },
    }).createOidcAccessToken({
      issuer: "https://identity.example.test",
      clientId: "system-console",
      accountId,
      scope: "openid email",
    })

    if (issued instanceof Error) throw issued
    expect(
      await new FindOidcAccessTokenAdapter({
        var: { database, now: () => new Date("2026-01-01T00:04:59.999Z") },
      }).findOidcAccessToken({
        issuer: "https://secondary.identity.example.test",
        accessToken: issued.accessToken,
      }),
    ).toBeNull()
    expect(
      await new FindOidcAccessTokenAdapter({
        var: { database, now: () => new Date("2026-01-01T00:04:59.999Z") },
      }).findOidcAccessToken({
        issuer: "https://identity.example.test",
        accessToken: issued.accessToken,
      }),
    ).toEqual({ clientId: "system-console", accountId, scope: "openid email" })
    expect(
      await new FindOidcAccessTokenAdapter({
        var: { database, now: () => new Date("2026-01-01T00:05:00.000Z") },
      }).findOidcAccessToken({
        issuer: "https://identity.example.test",
        accessToken: issued.accessToken,
      }),
    ).toBeNull()
  })
})
