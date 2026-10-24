import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { drizzle } from "drizzle-orm/d1"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { createCompanyEmployerTestContext } from "@/contexts/company/test/company-employer.test-support"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { prepareHistoricalCompanyResourceRevisionFixture } from "@/contexts/company/test/historical-company-resource-revision.test-support"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const files = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
const cutover = files.findIndex((file) => file.endsWith("_guard_company_employment_employers.sql"))
const read = (file: string) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8")
const migration = read(files[cutover] ?? "missing-employer-migration.sql")

test("製品の移行SQLは共有Company DDLと一致する", () => {
  expect(cutover).toBeGreaterThan(0)
  const schema = readFileSync(
    new URL("../infrastructure/schema/company.sql", import.meta.url),
    "utf8",
  )
  expect(schema).toContain(migration)
  expect(splitSqlStatements(migration)).toHaveLength(3)
})

test.each([false, true])(
  "既存の全改訂を保全し、不整合の有無に応じて移行を原子的に確定する: %s",
  async (invalid) => {
    const database = await createLocalD1Database({
      schema: files.slice(0, cutover).map(read).join("\n"),
    })
    await prepareHistoricalCompanyResourceRevisionFixture(database)
    const f = await createCompanyEmployerTestContext(database)
    if (invalid)
      expect(
        Number(
          (await f.write([f.employment], await f.companyRevision(), "employer:unresolved")).status,
        ),
      ).toBe(201)
    const before = await database
      .prepare(
        "SELECT * FROM company_resource_revisions ORDER BY organization_id, resource_type, resource_id, revision",
      )
      .all()
    const applied = await database
      .batch(splitSqlStatements(migration).map((statement) => database.prepare(statement)))
      .catch((cause: unknown) => cause)
    if (invalid) {
      expect(applied).toBeInstanceOf(Error)
      expect(
        await database
          .prepare(
            "SELECT name FROM sqlite_master WHERE name = 'company_employment_employer_reference_violations'",
          )
          .first(),
      ).toBeNull()
    } else {
      expect(applied).not.toBeInstanceOf(Error)
      expect(
        (await f.readEmployer("2030-06-01"))[0]?.attributes.employerLegalEntityId,
      ).toBeUndefined()
    }
    expect(
      (
        await database
          .prepare(
            "SELECT * FROM company_resource_revisions ORDER BY organization_id, resource_type, resource_id, revision",
          )
          .all()
      ).results,
    ).toEqual(before.results)
  },
)

test("Applicationを迂回した法人短縮もDBの最終確定で拒否し、全履歴と会社版を戻す", async () => {
  const f = await createCompanyEmployerTestContext()
  expect(
    Number(
      (await f.write([f.legalEntity, f.employment], await f.companyRevision(), "employer:initial"))
        .status,
    ),
  ).toBe(201)
  const before = await f.persisted()
  const change = CompanyResourceChangeEntity.create({
    commandId: "employer:direct-invalid",
    actorAccountId: f.creator.accountId,
    expectedRevision: await f.companyRevision(),
    reason: "Shorten employer period",
    recordedAt: Date.parse("2030-06-01T00:00:00Z"),
    resources: [
      {
        ...f.legalEntity,
        revision: 2,
        effectiveFrom: restoreCalendarDate(f.legalEntity.effectiveFrom),
        effectiveTo: restoreCalendarDate("2030-07-01"),
      },
    ],
  })
  if (change instanceof Error) throw change
  const prepared = await new CompanyResourceJournalAdapter({
    database: drizzle(f.database),
    d1: f.database,
  }).prepare(change)
  if (prepared instanceof Error) throw prepared
  const applied = await f.database
    .batch([...prepared.statements, prepared.commit])
    .catch((cause: unknown) => cause)
  expect(applied).toBeInstanceOf(Error)
  if (!(applied instanceof Error)) throw new Error("Uncovered employment was committed")
  expect(applied.message).toContain("company_employment_employer_reference_invalid")
  expect(await f.persisted()).toEqual(before)
  expect((await f.readEmployer("2030-08-01"))[0]?.attributes.employerLegalEntityId).toBe(
    f.legalEntity.id,
  )
})
