import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const files = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
const cutover = files.findIndex((file) =>
  file.endsWith("_preserve_company_personnel_annotations.sql"),
)
const read = (file: string) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8")
const columns =
  "CAST(id AS TEXT) AS id, employee_id, kind, effective_date, from_department_code, to_department_code, note, created_at"

test("注記の全列と大きなID・不明日付・孤立した対象を保全し、変更と削除を禁止する", async () => {
  expect(cutover).toBeGreaterThan(0)
  const database = await createLocalD1Database({
    schema: files.slice(0, cutover).map(read).join("\n"),
  })
  await database
    .prepare(`INSERT INTO company_employee_events VALUES
    (9223372036854775807, 'orphan:source', 'unknown-kind', 'date unknown', ' OLD ', '', '  original note  ', 'original timestamp'),
    (-2, '', '', '', NULL, NULL, '', ''),
    (3, 'missing', 'retire', '2020-01-01', NULL, NULL, NULL, '2021-02-03')`)
    .run()
  const before = await database
    .prepare(`SELECT ${columns} FROM company_employee_events ORDER BY id`)
    .all()
  for (const file of files.slice(cutover)) await execSql(database, read(file))
  // 主キーを UUID へ移した後は、移行元の整数の ID を legacy_id に残す。
  const afterColumns = `${columns.replace("CAST(id AS TEXT) AS id", "legacy_id AS id")} FROM company_personnel_annotations ORDER BY CAST(legacy_id AS INTEGER)`
  const after = await database.prepare(`SELECT ${afterColumns}`).all()
  expect(after.results).toEqual(before.results)
  expect(
    await database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'company_employee_events'",
      )
      .first(),
  ).toBeNull()
  for (const sql of [
    "UPDATE company_personnel_annotations SET note = 'changed'",
    "DELETE FROM company_personnel_annotations",
    "INSERT OR REPLACE INTO company_personnel_annotations VALUES (-2, 'changed', '', '', NULL, NULL, '', '')",
  ])
    expect(
      await database
        .prepare(sql)
        .run()
        .catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
  expect((await database.prepare(`SELECT ${afterColumns}`).all()).results).toEqual(before.results)
})
