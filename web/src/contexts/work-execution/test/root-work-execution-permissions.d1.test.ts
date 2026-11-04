import { expect, test } from "bun:test"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"

test("root role carries work-execution permissions so a sole admin can manage the ledger", async () => {
  const database = await createLocalD1Database()
  const rows = await database
    .prepare(
      `SELECT permission.permission_key AS key
       FROM system_iam_role_permissions permission
       INNER JOIN system_iam_roles role ON role.id = permission.role_id
       WHERE role.key = 'company:root' AND permission.permission_key LIKE 'work_execution:%'
       ORDER BY permission.permission_key`,
    )
    .all<{ key: string }>()
  expect(rows.results.map((row) => row.key)).toEqual([
    "work_execution:manage",
    "work_execution:read",
    "work_execution:record",
  ])
})
