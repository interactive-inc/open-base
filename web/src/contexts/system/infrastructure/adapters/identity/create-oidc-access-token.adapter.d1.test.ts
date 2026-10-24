import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { CreateOidcAccessTokenAdapter } from "@system/infrastructure/adapters/identity/create-oidc-access-token.adapter"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

describe("createOidcAccessToken", () => {
  test("平文tokenを保存しない", async () => {
    const fixture = await SystemSessionTestContext.create()
    await execSql(
      fixture.database,
      "INSERT INTO system_accounts (id, status, token_version, closed_at, created_at, updated_at) VALUES ('d5858208-e680-4db8-a05d-8bf4f900c24e', 'active', 0, NULL, 0, 0)",
    )
    const result = await new CreateOidcAccessTokenAdapter({
      var: {
        database: drizzle(fixture.context.env.DB, { schema: systemCoreSchema }),
        now: () => new Date("2026-01-01T00:00:00.000Z"),
      },
    }).createOidcAccessToken({
      issuer: "https://identity.example.test",
      clientId: "system-console",
      accountId: zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e"),
      scope: "openid",
    })

    if (result instanceof Error) throw result
    const stored = await fixture.database
      .prepare("SELECT token_hash FROM system_oidc_access_tokens")
      .first<{ token_hash: string }>()

    expect(stored?.token_hash).not.toBe(result.accessToken)
    expect(stored?.token_hash).toMatch(/^[a-f0-9]{64}$/)
  })
})
