import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { readSystemAccountDirectory } from "@system/interface/operations/read-system-account-directory"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { testAccountId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("System Account directoryは外部IdPを含む有効IdentityとAccount状態を返す", async () => {
  const fixture = await SystemSessionTestContext.create()
  await execSql(
    fixture.database,
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES
     ('34eb5dc4-74f0-4b35-ad3f-3ea77e9dc455', 'active', 0, 0, 100),
     ('5647424c-10fc-4bb9-b3e6-9b6357137cb0', 'suspended', 0, 0, 150),
     ('c4216367-b2fc-4e43-ad42-303c0cd2e31e', 'active', 0, 0, 0)`,
  )
  await execSql(
    fixture.database,
    `INSERT INTO system_identity_bindings
       (id, account_id, provider, subject, created_at, activated_at, revoked_at) VALUES
     ('fcee67fb-2e39-410b-87f0-6ca92bf06575', '34eb5dc4-74f0-4b35-ad3f-3ea77e9dc455', 'google', 'google-subject', 0, 1, NULL),
     ('98831416-954e-4749-a0fd-dc7999d849ca', '34eb5dc4-74f0-4b35-ad3f-3ea77e9dc455', 'password', 'password-subject', 0, 1, 50),
     ('b96496df-e6f2-49c9-8028-9ce82f36db05', '5647424c-10fc-4bb9-b3e6-9b6357137cb0', 'oidc', 'oidc-subject', 0, NULL, NULL)`,
  )
  await execSql(
    fixture.database,
    `INSERT INTO system_identity_profiles (identity_id, email, updated_at) VALUES
     ('fcee67fb-2e39-410b-87f0-6ca92bf06575', 'active@example.test', 10),
     ('98831416-954e-4749-a0fd-dc7999d849ca', 'revoked@example.test', 10),
     ('b96496df-e6f2-49c9-8028-9ce82f36db05', 'pending@example.test', 10)`,
  )

  const result = await readSystemAccountDirectory({
    database: fixture.context.env.DB,
    accountIds: [
      "34eb5dc4-74f0-4b35-ad3f-3ea77e9dc455",
      "5647424c-10fc-4bb9-b3e6-9b6357137cb0",
      "c4216367-b2fc-4e43-ad42-303c0cd2e31e",
      testAccountId("missing"),
      "34eb5dc4-74f0-4b35-ad3f-3ea77e9dc455",
    ],
  })
  expect(result).toEqual([
    {
      id: "34eb5dc4-74f0-4b35-ad3f-3ea77e9dc455",
      status: "active",
      updatedAt: new Date(100),
      hasLoginIdentity: true,
      email: "active@example.test",
    },
    {
      id: "5647424c-10fc-4bb9-b3e6-9b6357137cb0",
      status: "suspended",
      updatedAt: new Date(150),
      hasLoginIdentity: false,
      email: null,
    },
    {
      id: "c4216367-b2fc-4e43-ad42-303c0cd2e31e",
      status: "active",
      updatedAt: new Date(0),
      hasLoginIdentity: false,
      email: null,
    },
  ])
})
