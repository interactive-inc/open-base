import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { CreateOidcAuthorizationCodeAdapter } from "@system/infrastructure/adapters/identity/create-oidc-authorization-code.adapter"
import { hashOidcSecret } from "@system/application/auth/identity/lib/hash-oidc-secret"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

describe("createOidcAuthorizationCode", () => {
  test("平文codeを保存せずcanonical Accountへ束縛する", async () => {
    const fixture = await SystemSessionTestContext.create()
    const now = new Date("2026-01-01T00:00:00.000Z")
    await execSql(
      fixture.database,
      "INSERT INTO system_accounts (id, status, token_version, closed_at, created_at, updated_at) VALUES ('d5858208-e680-4db8-a05d-8bf4f900c24e', 'active', 0, NULL, 0, 0)",
    )
    const result = await new CreateOidcAuthorizationCodeAdapter({
      var: {
        database: drizzle(fixture.context.env.DB, { schema: systemCoreSchema }),
        now: () => now,
      },
    }).createOidcAuthorizationCode({
      issuer: "https://identity.example.test",
      clientId: "system-console",
      redirectUri: "https://console.example.test/callback",
      accountId: zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e"),
      codeChallenge: "a".repeat(43),
      nonce: "nonce-with-enough-entropy",
      scope: ["openid"],
    })

    if (result instanceof Error) throw result
    const stored = await fixture.database
      .prepare("SELECT code_hash, account_id FROM system_oidc_authorization_codes")
      .first<Record<string, unknown>>()

    expect(stored).toEqual({
      code_hash: await hashOidcSecret(result.code),
      account_id: "d5858208-e680-4db8-a05d-8bf4f900c24e",
    })
    expect(stored).not.toEqual({
      code_hash: result.code,
      account_id: "d5858208-e680-4db8-a05d-8bf4f900c24e",
    })
  })
})
