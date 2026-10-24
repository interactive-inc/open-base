import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { prepareSystemAccountInvitationCreation } from "@system/interface/operations/system-account-invitations"
import { revokeSystemAccountInvitation } from "@system/interface/operations/revoke-system-account-invitation"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const schema = `
  CREATE TABLE system_account_invitations (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    subject TEXT,
    role_id TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    related_resource_id TEXT,
    accepted_by_account_id TEXT,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE satellite_records (
    invite_id TEXT NOT NULL REFERENCES system_account_invitations(id),
    facility_id TEXT NOT NULL
  );
`

const createdAt = new Date("2026-09-18T00:00:00.000Z")

function prepare(database: D1Database) {
  return prepareSystemAccountInvitationCreation(database, {
    id: "invite-1",
    token: "a".repeat(64),
    subject: "person@example.com",
    roleId: "a290ac92-bf4b-434b-8443-8b6ceeb1cb85",
    resourceType: "care:facility",
    resourceId: "facility-1",
    relatedResourceId: "assignment-1",
    createdAt,
    expiresAt: new Date(createdAt.getTime() + 86_400_000),
  })
}

describe("System account invitations", () => {
  test("付随情報が失敗すると System 招待も保存しない", async () => {
    const database = await createLocalD1Database({ schema })
    const invitation = prepare(database)
    expect(invitation).not.toBeInstanceOf(Error)
    if (invitation instanceof Error) throw invitation

    await expect(
      database.batch([
        invitation,
        database.prepare(
          "INSERT INTO satellite_records (invite_id, facility_id) VALUES ('invite-1', NULL)",
        ),
      ]),
    ).rejects.toThrow()

    expect(await database.prepare("SELECT id FROM system_account_invitations").first()).toBeNull()
  })

  test("使用済み招待は取り消さず、未使用招待の再取消は冪等", async () => {
    const database = await createLocalD1Database({ schema })
    const invitation = prepare(database)
    if (invitation instanceof Error) throw invitation
    await invitation.run()

    const writtenAt = new Date(createdAt.getTime() + 1_000)
    expect(await revokeSystemAccountInvitation(database, { id: "invite-1", writtenAt })).toBe(
      "revoked",
    )
    expect(await revokeSystemAccountInvitation(database, { id: "invite-1", writtenAt })).toBe(
      "already_revoked",
    )
    expect(await revokeSystemAccountInvitation(database, { id: "missing", writtenAt })).toBe(
      "not_found",
    )

    await database
      .prepare("UPDATE system_account_invitations SET accepted_by_account_id = 'account-1'")
      .run()
    expect(await revokeSystemAccountInvitation(database, { id: "invite-1", writtenAt })).toBe(
      "used",
    )
  })

  test("不正なリソースと時刻の招待を準備しない", async () => {
    const database = await createLocalD1Database({ schema })
    const invalid = prepareSystemAccountInvitationCreation(database, {
      id: "invite-2",
      token: "b".repeat(64),
      subject: null,
      roleId: "a290ac92-bf4b-434b-8443-8b6ceeb1cb85",
      resourceType: null,
      resourceId: "facility-1",
      relatedResourceId: null,
      createdAt,
      expiresAt: createdAt,
    })
    expect(invalid).toBeInstanceOf(Error)
  })
})
