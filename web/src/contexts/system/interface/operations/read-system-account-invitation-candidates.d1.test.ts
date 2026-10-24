import { readSystemAccountInvitationCandidates } from "@system/interface/operations/read-system-account-invitation-candidates"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const schema = `CREATE TABLE system_account_invitations (
  id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, subject TEXT, role_id TEXT NOT NULL,
  resource_type TEXT, resource_id TEXT, related_resource_id TEXT,
  accepted_by_account_id TEXT, expires_at INTEGER NOT NULL, revoked_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
)`

test("System招待のtoken候補は業務payloadなしで読み取れる", async () => {
  const database = await createLocalD1Database({ schema })
  await database
    .prepare(
      `INSERT INTO system_account_invitations
       (id, token, subject, role_id, resource_type, resource_id, related_resource_id,
        accepted_by_account_id, expires_at, revoked_at, created_at, updated_at)
       VALUES ('59a67a5b-819c-48be-9d79-300e30632641', 'digest', 'person@example.com', 'a290ac92-bf4b-434b-8443-8b6ceeb1cb85', 'demo:scope', 'resource-1',
               'related-1', NULL, 200, NULL, 100, 100)`,
    )
    .run()

  const result = await readSystemAccountInvitationCandidates(database, ["raw", "digest"])
  expect(result).not.toBeInstanceOf(Error)
  if (result instanceof Error) throw result
  expect(result).toEqual([
    {
      id: "59a67a5b-819c-48be-9d79-300e30632641",
      token: "digest",
      email: "person@example.com",
      roleId: "a290ac92-bf4b-434b-8443-8b6ceeb1cb85",
      resourceType: "demo:scope",
      resourceId: "resource-1",
      relatedResourceId: "related-1",
      usedBy: null,
      expiresAt: new Date(200),
      revokedAt: null,
      createdAt: new Date(100),
      updatedAt: new Date(100),
    },
  ])
})

test("空のtoken候補はDB照会せず拒否する", async () => {
  const database = await createLocalD1Database({ schema })
  expect(await readSystemAccountInvitationCandidates(database, [])).toBeInstanceOf(Error)
})
