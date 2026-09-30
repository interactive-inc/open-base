import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { drizzle } from "drizzle-orm/d1"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { createCompanyPlaceTestContext } from "@/contexts/company/test/company-place.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const marker = "CREATE VIEW company_place_reference_period_violations AS"
const schema =
  readFileSync(
    new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
    "utf8",
  ) +
  "\n" +
  readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8")
const start = schema.indexOf(marker)
const migrationFiles = readdirSync(COMPANY_TEST_MIGRATIONS_DIR).filter((name) =>
  /^\d+_guard_company_place_reference_periods\.sql$/.test(name),
)
const migration = readFileSync(
  join(COMPANY_TEST_MIGRATIONS_DIR, migrationFiles[0] ?? "missing-place-migration.sql"),
  "utf8",
)

test("各製品のmigrationは共有Company DDLと一致し、triggerを完全なstatementとして分割できる", () => {
  expect(start).toBeGreaterThan(0)
  expect(migrationFiles).toHaveLength(1)
  expect(schema.slice(start, start + migration.length)).toBe(migration)
  const triggers = splitSqlStatements(migration).filter((statement) =>
    /^CREATE TRIGGER/m.test(statement),
  )
  expect(triggers).toHaveLength(3)
  for (const trigger of triggers) {
    expect(trigger).toMatch(/END\s*;?\s*$/)
    expect(trigger.slice(trigger.indexOf("BEGIN"))).not.toMatch(/\bCASE\b/i)
  }
})

test.each(["legalEntity", "site", "unit"] as const)(
  "既存の %s の不整合では制約の置換前にmigrationを停止し、全履歴を保全する",
  async (kind) => {
    const f = await createCompanyPlaceTestContext(schema.slice(0, start))
    expect(
      await f.write({
        resources: f.resources.map((resource) =>
          resource === f[kind]
            ? { ...resource, effectiveTo: restoreCalendarDate("2030-07-01") }
            : resource,
        ),
        expectedRevision: 0,
      }),
    ).toMatchObject({ kind: "applied" })
    const before = await f.saved()
    const triggersBefore = (
      await f.database
        .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name")
        .all()
    ).results
    const applied = await f.database
      .batch(splitSqlStatements(migration).map((sql) => f.database.prepare(sql)))
      .catch((cause: unknown) => cause)
    expect(applied).toBeInstanceOf(Error)
    if (!(applied instanceof Error)) throw new Error("Invalid place history was migrated")
    expect(applied.message).toContain("company_place_reference_period_not_covered")
    expect(await f.saved()).toEqual(before)
    expect(
      (
        await f.database
          .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name")
          .all()
      ).results,
    ).toEqual(triggersBefore)
    expect(
      await f.database
        .prepare(
          "SELECT name FROM sqlite_master WHERE name = 'company_place_reference_period_violations'",
        )
        .first(),
    ).toBeNull()
  },
)

test("整合した過去の閉鎖と訂正履歴をmigrationが書き換えず、以後の孤立だけを拒否する", async () => {
  const f = await createCompanyPlaceTestContext(schema.slice(0, start))
  expect(await f.write({ resources: f.resources, expectedRevision: 0 })).toMatchObject({
    kind: "applied",
  })
  expect(
    await f.write({
      resources: [f.legalEntity, f.site, f.workplace].map((resource) => ({
        ...resource,
        revision: 2,
        state: "void",
        effectiveFrom: restoreCalendarDate("2030-07-01"),
      })),
      expectedRevision: 1,
    }),
  ).toMatchObject({ kind: "applied" })
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
      resources: [{ ...f.site, revision: 3, effectiveTo: restoreCalendarDate("2030-06-01") }],
      expectedRevision: 2,
    }),
  ).toMatchObject({ kind: "invalid" })
  expect(await f.saved()).toEqual(before)
})

test("Applicationの検証を通さないbatchでも会社版の確定時に拒否し、履歴と再送記録を取り消す", async () => {
  const f = await createCompanyPlaceTestContext()
  expect(await f.write({ resources: f.resources, expectedRevision: 0 })).toMatchObject({
    kind: "applied",
  })
  const before = await f.saved()
  const change = CompanyResourceChangeEntity.create({
    commandId: "direct-command",
    actorAccountId: "account:operator",
    reason: "Attempt independent closure",
    recordedAt: Date.parse("2030-06-01T00:00:00Z"),
    expectedRevision: 1,
    resources: [{ ...f.site, revision: 2, effectiveTo: restoreCalendarDate("2030-07-01") }],
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
  if (!(attempted instanceof Error)) throw new Error("Invalid place reference was committed")
  expect(attempted.message).toContain("company_place_reference_period_not_covered")
  expect(await f.saved()).toEqual(before)
})
