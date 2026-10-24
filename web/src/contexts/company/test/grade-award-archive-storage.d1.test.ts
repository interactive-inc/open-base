import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const companySql = readFileSync(
  new URL("../infrastructure/schema/company.sql", import.meta.url),
  "utf8",
)
const archiveSql = companySql.slice(
  companySql.indexOf("CREATE TABLE company_grade_award_archives"),
  companySql.indexOf(
    "\nEND;",
    companySql.indexOf("CREATE TRIGGER company_grade_award_archive_no_delete"),
  ) + 5,
)

test("保全記録の所属・参照先と不変性をDBで強制し、元台帳がなくても原記録を保持する", async () => {
  const db = await createLocalD1Database({
    schema: `PRAGMA foreign_keys=ON;
    CREATE TABLE company_organizations(id TEXT PRIMARY KEY); INSERT INTO company_organizations VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}');
    CREATE TABLE company_employees(id TEXT PRIMARY KEY); INSERT INTO company_employees VALUES ('9e174baf-3240-4253-9cba-16bc3e431cca');
    CREATE TABLE system_accounts(id TEXT PRIMARY KEY); INSERT INTO system_accounts VALUES ('a63d1b89-54f5-4001-8ed7-f2077c91340d');
    ${archiveSql}`,
  })
  const sourceJson = JSON.stringify({
    employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
    organizationRevision: 8,
    awards: [],
  })
  const insert = () =>
    db
      .prepare(`INSERT INTO company_grade_award_archives
    (organization_id, command_id, employee_id, fingerprint, actor_account_id, reason, observed_on,
     observed_company_revision, snapshot_digest, source_json, recorded_at) VALUES
    ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'archive:one', '9e174baf-3240-4253-9cba-16bc3e431cca', ?1, 'a63d1b89-54f5-4001-8ed7-f2077c91340d', 'Preserve original records',
    '2030-01-01', 8, ?1, ?2, 1)`)
      .bind("a".repeat(64), sourceJson)
  await insert().run()
  for (const sql of [
    "UPDATE company_grade_award_archives SET reason = 'Changed'",
    "DELETE FROM company_grade_award_archives",
    "DELETE FROM company_employees",
    "DELETE FROM system_accounts",
  ])
    expect(
      await db
        .prepare(sql)
        .run()
        .catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
  expect(
    await insert()
      .run()
      .catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  expect(
    await db
      .prepare("SELECT source_json FROM company_grade_award_archives")
      .first<string>("source_json"),
  ).toBe(sourceJson)
})
