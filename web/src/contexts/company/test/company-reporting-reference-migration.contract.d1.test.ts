import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { drizzle } from "drizzle-orm/d1"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { createCompanyReportingReferenceTestContext } from "@/contexts/company/test/company-reporting-reference.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const marker = "CREATE VIEW company_reporting_reference_period_violations AS"
const schema =
  readFileSync(
    new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
    "utf8",
  ) +
  "\n" +
  readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8")
const start = schema.indexOf(marker)
const migrationFiles = readdirSync(COMPANY_TEST_MIGRATIONS_DIR).filter((name) =>
  /^\d+_guard_company_reporting_reference_periods\.sql$/.test(name),
)
const migration = readFileSync(
  join(COMPANY_TEST_MIGRATIONS_DIR, migrationFiles[0] ?? "missing-reporting-migration.sql"),
  "utf8",
)

test("共有DDLと製品migrationが一致し、既存検査をtrigger追加より先に実行する", () => {
  expect(start).toBeGreaterThan(0)
  expect(migrationFiles).toHaveLength(1)
  expect(schema.slice(start, start + migration.length)).toBe(migration)
  const statements = splitSqlStatements(migration)
  expect(statements).toHaveLength(3)
  expect(statements[0]).toContain(marker)
  expect(statements[1]).toContain(
    "SELECT json_extract('{}', 'company_reporting_reference_period_not_covered')",
  )
  expect(statements[2]).toContain("CREATE TRIGGER company_reporting_reference_period_commit_guard")
  expect(statements[2]).toMatch(/END\s*;?\s*$/)
  expect(statements[2]?.slice(statements[2].indexOf("BEGIN"))).not.toMatch(/\bCASE\b/i)
})

test("既存の終了済み上長関係が組織の期間外なら移行を止め、履歴と制約を保持する", async () => {
  const f = await createCompanyReportingReferenceTestContext(schema.slice(0, start))
  expect(await f.write({ resources: f.resources, expectedRevision: 0 })).toMatchObject({
    kind: "applied",
  })
  expect(await f.write({ resources: [f.closed], expectedRevision: 1 })).toMatchObject({
    kind: "applied",
  })
  expect(
    await f.write({
      resources: [{ ...f.unit, revision: 2, effectiveTo: restoreCalendarDate("2030-06-01") }],
      expectedRevision: 2,
    }),
  ).toMatchObject({ kind: "applied" })
  const before = await f.saved()
  const history = (
    await f.database.prepare("SELECT rowid, * FROM company_resource_revisions ORDER BY rowid").all()
  ).results
  const objects = (
    await f.database.prepare("SELECT type, name, sql FROM sqlite_master ORDER BY type, name").all()
  ).results
  const applied = await f.database
    .batch(splitSqlStatements(migration).map((sql) => f.database.prepare(sql)))
    .catch((cause: unknown) => cause)
  expect(applied).toBeInstanceOf(Error)
  if (!(applied instanceof Error)) throw new Error("Invalid reporting history was migrated")
  expect(applied.message).toContain("company_reporting_reference_period_not_covered")
  expect(await f.saved()).toEqual(before)
  expect(
    (
      await f.database
        .prepare("SELECT rowid, * FROM company_resource_revisions ORDER BY rowid")
        .all()
    ).results,
  ).toEqual(history)
  expect(
    (
      await f.database
        .prepare("SELECT type, name, sql FROM sqlite_master ORDER BY type, name")
        .all()
    ).results,
  ).toEqual(objects)
})

test("正常な過去の上長関係を移行時に変更せず、以後の組織短縮を拒否する", async () => {
  const f = await createCompanyReportingReferenceTestContext(schema.slice(0, start))
  expect(await f.write({ resources: f.resources, expectedRevision: 0 })).toMatchObject({
    kind: "applied",
  })
  expect(await f.write({ resources: [f.closed], expectedRevision: 1 })).toMatchObject({
    kind: "applied",
  })
  const before = await f.saved()
  const history = (
    await f.database.prepare("SELECT rowid, * FROM company_resource_revisions ORDER BY rowid").all()
  ).results
  await f.database.batch(splitSqlStatements(migration).map((sql) => f.database.prepare(sql)))
  expect(await f.saved()).toEqual(before)
  expect(
    (
      await f.database
        .prepare("SELECT rowid, * FROM company_resource_revisions ORDER BY rowid")
        .all()
    ).results,
  ).toEqual(history)
  expect(
    await f.write({
      resources: [{ ...f.unit, revision: 2, effectiveTo: restoreCalendarDate("2030-06-01") }],
      expectedRevision: 2,
    }),
  ).toMatchObject({ kind: "invalid" })
  expect(await f.saved()).toEqual(before)
})

test("Applicationを迂回したDB保存でも、会社版・上長参照・履歴・再送記録を一括検査する", async () => {
  const f = await createCompanyReportingReferenceTestContext()
  expect(await f.write({ resources: f.resources, expectedRevision: 0 })).toMatchObject({
    kind: "applied",
  })
  expect(await f.write({ resources: [f.closed], expectedRevision: 1 })).toMatchObject({
    kind: "applied",
  })
  const before = await f.saved()
  const change = CompanyResourceChangeEntity.create({
    commandId: "direct-reporting-command",
    actorAccountId: "account:operator",
    reason: "Confirm reporting history",
    recordedAt: Date.parse("2030-06-01T00:00:00Z"),
    expectedRevision: 2,
    resources: [{ ...f.unit, revision: 2, effectiveTo: restoreCalendarDate("2030-06-01") }],
  })
  if (change instanceof Error) throw change
  const prepared = await new CompanyResourceJournalAdapter({
    database: drizzle(f.database),
    d1: f.database,
  }).prepare(change)
  if (prepared instanceof Error) throw prepared
  const attempted = await f.database
    .batch([...prepared.statements, prepared.commit])
    .catch((cause: unknown) => cause)
  expect(attempted).toBeInstanceOf(Error)
  if (!(attempted instanceof Error)) throw new Error("Invalid reporting reference was committed")
  expect(attempted.message).toContain("company_reporting_reference_period_not_covered")
  expect(await f.saved()).toEqual(before)
})
