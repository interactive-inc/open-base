import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemIdentityCatalogRepository } from "@system/infrastructure/repositories/identity/system-identity-catalog.repository"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

// 認証方式の名前と並ぶ行は ID を変数で渡す。
const secondIdentity = "874fda28-9acd-46ea-b25a-a8d278d4c5b6"
const fourthIdentity = "e3f97e43-bf6d-4aa9-932f-8ab67c9187af"

test("Accountごとに優先する有効なIdentity emailを1件返す", async () => {
  const fixture = await SystemSessionTestContext.create()
  const firstAccountId = zAccountId.parse("ea233ed4-e265-46f4-b6e2-ec8b664fd423")
  const secondAccountId = zAccountId.parse("8576d066-61d5-4d76-a494-901491c6fe34")

  await execSql(
    fixture.database,
    `
    INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
    VALUES
      ('ea233ed4-e265-46f4-b6e2-ec8b664fd423', 'active', 0, 1, 1),
      ('8576d066-61d5-4d76-a494-901491c6fe34', 'active', 0, 1, 1);

    INSERT INTO system_identity_bindings
      (id, account_id, provider, subject, created_at, activated_at, revoked_at)
    VALUES
      ('d439d4b2-b84d-4f9b-9d30-83fd26d2cf13', 'ea233ed4-e265-46f4-b6e2-ec8b664fd423', 'oidc', 'd439d4b2-b84d-4f9b-9d30-83fd26d2cf13', 1, 1, NULL),
      ('${secondIdentity}', 'ea233ed4-e265-46f4-b6e2-ec8b664fd423', 'password', '${secondIdentity}', 2, 2, NULL),
      ('e5b0346d-fffb-443c-b7cd-a2c5639a4a22', 'ea233ed4-e265-46f4-b6e2-ec8b664fd423', 'oidc', 'e5b0346d-fffb-443c-b7cd-a2c5639a4a22', 3, 3, 4),
      ('${fourthIdentity}', '8576d066-61d5-4d76-a494-901491c6fe34', 'password', '${fourthIdentity}', 1, 1, NULL);

    INSERT INTO system_identity_profiles
      (identity_id, email, email_verified, can_receive_email, last_used_at, updated_at)
    VALUES
      ('d439d4b2-b84d-4f9b-9d30-83fd26d2cf13', 'unverified@example.test', 0, 1, 10, 10),
      ('${secondIdentity}', 'verified@example.test', 1, 1, 5, 5),
      ('e5b0346d-fffb-443c-b7cd-a2c5639a4a22', 'revoked@example.test', 1, 1, 20, 20),
      ('${fourthIdentity}', 'second@example.test', 1, 1, 1, 1);
  `,
  )

  const result = await new SystemIdentityCatalogRepository(
    fixture.context,
  ).primaryEmailsForAccounts([firstAccountId, secondAccountId])

  expect(result).not.toBeInstanceOf(Error)
  expect(result instanceof Error ? [] : [...result]).toEqual([
    [secondAccountId, "second@example.test"],
    [firstAccountId, "verified@example.test"],
  ])
})
