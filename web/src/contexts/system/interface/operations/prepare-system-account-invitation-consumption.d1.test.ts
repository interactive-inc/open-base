import { prepareSystemAccountInvitationConsumption } from "@system/interface/operations/prepare-system-account-invitation-consumption"
import type { SystemAccountSnapshot } from "@system/interface/operations/read-system-account-snapshot"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { sql } from "drizzle-orm"
import { testAccountId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const invitedAccount = testAccountId("account-1")

const schema = `
  CREATE TABLE system_accounts (
    id TEXT PRIMARY KEY, status TEXT NOT NULL, token_version INTEGER NOT NULL,
    closed_at INTEGER, updated_at INTEGER NOT NULL
  );
  CREATE TABLE system_iam_roles (id TEXT PRIMARY KEY, resource_type TEXT, updated_at INTEGER NOT NULL);
  CREATE TABLE system_account_invitations (
    id TEXT PRIMARY KEY, token TEXT NOT NULL, subject TEXT, role_id TEXT NOT NULL,
    accepted_by_account_id TEXT, expires_at INTEGER NOT NULL, revoked_at INTEGER,
    updated_at INTEGER NOT NULL
  );
  INSERT INTO system_iam_roles VALUES ('a290ac92-bf4b-434b-8443-8b6ceeb1cb85', NULL, 100);
  INSERT INTO system_accounts VALUES ('${invitedAccount}', 'active', 0, NULL, 100);
  INSERT INTO system_account_invitations VALUES
    ('invite-1', 'digest-1', 'person@example.com', 'a290ac92-bf4b-434b-8443-8b6ceeb1cb85', NULL, 1000, NULL, 100),
    ('invite-2', 'digest-2', 'person@example.com', 'a290ac92-bf4b-434b-8443-8b6ceeb1cb85', NULL, 1000, NULL, 100);
`

test("System招待受諾はsnapshotと追加条件が一致するときだけ更新する", async () => {
  const database = await createLocalD1Database({ schema })
  const prepare = (
    id: string,
    storedToken: string,
    additionalConditions = [sql`1 = 1`],
    expectedExistingAccount: SystemAccountSnapshot | null = null,
  ) =>
    prepareSystemAccountInvitationConsumption(database, {
      id,
      storedToken,
      expectedEmail: "person@example.com",
      roleId: "a290ac92-bf4b-434b-8443-8b6ceeb1cb85",
      expectedUpdatedAt: new Date(100),
      expectedExpiresAt: new Date(1000),
      expectedRoleUpdatedAt: new Date(100),
      expectedRoleResourceType: null,
      acceptedByAccountId: invitedAccount,
      consumedAt: new Date(200),
      expectedExistingAccount,
      additionalConditions,
    })

  const denied = prepare("invite-1", "digest-1", [sql`1 = 0`])
  if (denied instanceof Error) throw denied
  await denied.run()
  expect(
    await database
      .prepare(
        "SELECT accepted_by_account_id FROM system_account_invitations WHERE id = 'invite-1'",
      )
      .first<{ accepted_by_account_id: string | null }>(),
  ).toEqual({ accepted_by_account_id: null })

  const consumed = prepare("invite-1", "digest-1")
  if (consumed instanceof Error) throw consumed
  await consumed.run()
  expect(
    await database
      .prepare(
        "SELECT accepted_by_account_id FROM system_account_invitations WHERE id = 'invite-1'",
      )
      .first<{ accepted_by_account_id: string | null }>(),
  ).toEqual({ accepted_by_account_id: invitedAccount })

  await database
    .prepare(`UPDATE system_accounts SET token_version = 1 WHERE id = '${invitedAccount}'`)
    .run()
  const accountDrift = prepare("invite-2", "digest-2", [sql`1 = 1`], {
    id: invitedAccount,
    status: "active",
    tokenVersion: 0,
    closedAt: null,
    updatedAt: new Date(100),
  })
  if (accountDrift instanceof Error) throw accountDrift
  await accountDrift.run()
  expect(
    await database
      .prepare(
        "SELECT accepted_by_account_id FROM system_account_invitations WHERE id = 'invite-2'",
      )
      .first<{ accepted_by_account_id: string | null }>(),
  ).toEqual({ accepted_by_account_id: null })

  await database
    .prepare(
      "UPDATE system_iam_roles SET updated_at = 201 WHERE id = 'a290ac92-bf4b-434b-8443-8b6ceeb1cb85'",
    )
    .run()
  const stale = prepare("invite-2", "digest-2")
  if (stale instanceof Error) throw stale
  await stale.run()
  expect(
    await database
      .prepare(
        "SELECT accepted_by_account_id FROM system_account_invitations WHERE id = 'invite-2'",
      )
      .first<{ accepted_by_account_id: string | null }>(),
  ).toEqual({ accepted_by_account_id: null })
})
