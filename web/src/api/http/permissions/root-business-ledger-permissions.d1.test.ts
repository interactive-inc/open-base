import { expect, test } from "bun:test"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"

test("root role carries the opt-in ledger permissions so a sole admin can manage them", async () => {
  const database = await createLocalD1Database()
  const rows = await database
    .prepare(
      `SELECT permission.permission_key AS key
       FROM system_iam_role_permissions permission
       INNER JOIN system_iam_roles role ON role.id = permission.role_id
       WHERE role.key = 'company:root'
         AND (permission.permission_key LIKE 'customer:%'
           OR permission.permission_key LIKE 'offering:%'
           OR permission.permission_key LIKE 'client_project:%')
       ORDER BY permission.permission_key`,
    )
    .all<{ key: string }>()
  expect(rows.results.map((row) => row.key)).toEqual([
    "client_project:read",
    "client_project:record",
    "client_project:write",
    "customer:read",
    "customer:write",
    "offering:read",
    "offering:write",
  ])
})
