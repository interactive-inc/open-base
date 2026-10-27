import { listSystemAccountInvitations } from "@system/interface/operations/list-system-account-invitations"
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

test("System招待一覧は未受諾の招待を新しい順に限定する", async () => {
  const database = await createLocalD1Database({ schema })
  for (const [id, createdAt, usedBy] of [
    ["old", 100, null],
    ["new", 200, null],
    ["used", 300, "account-1"],
  ] as const) {
    await database
      .prepare(
        `INSERT INTO system_account_invitations
         (id, token, role_id, accepted_by_account_id, expires_at, created_at, updated_at)
         VALUES (?1, ?1, 'a290ac92-bf4b-434b-8443-8b6ceeb1cb85', ?2, 1000, ?3, ?3)`,
      )
      .bind(id, usedBy, createdAt)
      .run()
  }

  const rows = await listSystemAccountInvitations(database, 1)
  expect(rows).not.toBeInstanceOf(Error)
  if (rows instanceof Error) throw rows
  expect(rows.map((row) => row.id)).toEqual(["new"])
})
