import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { SystemAccessTokenStateAdapter } from "@system/infrastructure/adapters/auth/system-access-token-state.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const input = {
  accountId: zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e"),
  tokenVersion: 0,
  issuedAtMs: 1_000,
  sessionFamilyId: null,
  at: new Date(1_000),
}

async function createFixture() {
  const fixture = await SystemSessionTestContext.create()
  await execSql(
    fixture.database,
    `
    INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
    VALUES ('d5858208-e680-4db8-a05d-8bf4f900c24e', 'active', 0, 1, 1), ('4b0518fd-9017-4afc-addd-bb50998b0273', 'active', 0, 1, 1);
    INSERT INTO system_principals
    (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
    VALUES ('4392b600-7e0f-470a-9330-bfb3344f6a5b', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'service', 'Primary', NULL, 1, 1, 1),
           ('4474863f-42a0-4e22-ae28-61a0d4a475ad', '4b0518fd-9017-4afc-addd-bb50998b0273', 'service', 'Other', NULL, 1, 1, 1);
  `,
  )
  await fixture.database
    .prepare(`
    INSERT INTO system_machine_credentials
    (id, principal_id, name, secret_hash, status, created_at, updated_at, last_used_at, expires_at)
    VALUES ('ad6a0f96-902f-4999-84f6-2b9eb703c2ed', '4392b600-7e0f-470a-9330-bfb3344f6a5b', 'Primary', ?1, 'active', 100, 1000, 1000, 2000),
           ('64571a17-dadf-476c-b4ab-d793d738ef0c', '4474863f-42a0-4e22-ae28-61a0d4a475ad', 'Other', ?2, 'active', 100, 1000, 1000, 2000)
  `)
    .bind("1".repeat(64), "2".repeat(64))
    .run()
  return fixture
}

describe("SystemAccessTokenStateAdapter", () => {
  test("D1と注入されたDrizzle driverで同じ主体と来歴を復元する", async () => {
    const fixture = await createFixture()
    for (const database of [fixture.context.env.DB, drizzle(fixture.context.env.DB)]) {
      const state = await new SystemAccessTokenStateAdapter({ database }).resolve({
        ...input,
        machineCredentialId: "ad6a0f96-902f-4999-84f6-2b9eb703c2ed",
      })
      expect(state).toMatchObject({
        kind: "accepted",
        account: { id: "d5858208-e680-4db8-a05d-8bf4f900c24e" },
        machine: {
          principalId: "4392b600-7e0f-470a-9330-bfb3344f6a5b",
          kind: "service",
          credentialId: "ad6a0f96-902f-4999-84f6-2b9eb703c2ed",
          connectorId: null,
        },
      })
      expect(JSON.stringify(state)).not.toContain("1".repeat(64))
    }
  })

  test("別Accountのcredentialを同じ有効期限・版で指定しても拒否する", async () => {
    const fixture = await createFixture()
    expect(
      await new SystemAccessTokenStateAdapter({ database: fixture.context.env.DB }).resolve({
        ...input,
        machineCredentialId: "64571a17-dadf-476c-b4ab-d793d738ef0c",
      }),
    ).toEqual({ kind: "rejected", reason: "invalid_machine_credential" })
  })

  test.each([99, 1_001, 2_000])(
    "credentialの作成前・最終認証後・失効時点の発行時刻%sを拒否する",
    async (issuedAtMs) => {
      const fixture = await createFixture()
      expect(
        await new SystemAccessTokenStateAdapter({ database: fixture.context.env.DB }).resolve({
          ...input,
          machineCredentialId: "ad6a0f96-902f-4999-84f6-2b9eb703c2ed",
          issuedAtMs,
        }),
      ).toEqual({ kind: "rejected", reason: "invalid_machine_credential" })
    },
  )

  test("Humanへ変更されたPrincipalは機械credentialを利用できない", async () => {
    const fixture = await createFixture()
    await execSql(
      fixture.database,
      "UPDATE system_principals SET kind = 'human', revision = revision + 1",
    )
    expect(
      await new SystemAccessTokenStateAdapter({ database: fixture.context.env.DB }).resolve({
        ...input,
        machineCredentialId: "ad6a0f96-902f-4999-84f6-2b9eb703c2ed",
      }),
    ).toEqual({ kind: "rejected", reason: "invalid_machine_credential" })
  })

  test("人のtokenはHumanおよびPrincipal導入前のAccountで継続する", async () => {
    const fixture = await createFixture()
    await execSql(
      fixture.database,
      `
      UPDATE system_principals SET kind = 'human', revision = revision + 1;
      INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
      VALUES ('964d96c2-4c23-4fc2-ac6d-296e5d5870b9', 'active', 0, 1, 1);
    `,
    )
    for (const accountId of [
      input.accountId,
      zAccountId.parse("964d96c2-4c23-4fc2-ac6d-296e5d5870b9"),
    ]) {
      expect(
        await new SystemAccessTokenStateAdapter({ database: fixture.context.env.DB }).resolve({
          ...input,
          accountId,
        }),
      ).toMatchObject({ kind: "accepted", machine: null })
    }
  })

  test("状態の読取失敗を認証成功へfallbackしない", async () => {
    const fixture = await createFixture()
    await execSql(fixture.database, "ALTER TABLE system_accounts RENAME TO unavailable_accounts")
    expect(
      await new SystemAccessTokenStateAdapter({ database: fixture.context.env.DB }).resolve({
        ...input,
        machineCredentialId: "ad6a0f96-902f-4999-84f6-2b9eb703c2ed",
      }),
    ).toBeInstanceOf(Error)
  })
})
