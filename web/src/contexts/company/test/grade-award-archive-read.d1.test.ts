import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { GradeAwardSourceSnapshotValue } from "@/contexts/company/domain/values/grade-award-source-snapshot.value"
import { GradeAwardArchiveReadAdapter } from "@/contexts/company/infrastructure/adapters/definitions/grade-award-archive-read.adapter"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const portable = readFileSync(
  new URL("../infrastructure/schema/company.sql", import.meta.url),
  "utf8",
)
const archiveSql = portable.slice(
  portable.indexOf("CREATE TABLE company_grade_award_archives"),
  portable.indexOf(
    "\nEND;",
    portable.indexOf("CREATE TRIGGER company_grade_award_archive_no_delete"),
  ) + 5,
)

/** 旧台帳を作らず、移行前に保全された原文を配置する。 */
async function fixture(corruptDigest = false) {
  const database = await createLocalD1Database({
    schema: `
    CREATE TABLE company_organizations(id TEXT PRIMARY KEY, revision INTEGER);
    INSERT INTO company_organizations VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 8);
    CREATE TABLE company_employees(id TEXT PRIMARY KEY); INSERT INTO company_employees VALUES ('9e174baf-3240-4253-9cba-16bc3e431cca');
    CREATE TABLE system_accounts(id TEXT PRIMARY KEY); INSERT INTO system_accounts VALUES ('a63d1b89-54f5-4001-8ed7-f2077c91340d');
    ${archiveSql}`,
  })
  const snapshot = await GradeAwardSourceSnapshotValue.create(
    JSON.stringify({
      organizationRevision: 8,
      employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
      awards: [
        {
          id: "9007199254740993",
          employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
          gradeId: 1,
          effectiveDate: "2020-01-01",
          reason: " original ",
          createdAt: "unknown",
          observedDefinition: null,
        },
      ],
    }),
  )
  if (snapshot instanceof Error) throw snapshot
  await database
    .prepare(`INSERT INTO company_grade_award_archives
    (organization_id, command_id, employee_id, fingerprint, actor_account_id, reason, observed_on,
      observed_company_revision, snapshot_digest, source_json, recorded_at)
    VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'archive:one', '9e174baf-3240-4253-9cba-16bc3e431cca', ?1, 'a63d1b89-54f5-4001-8ed7-f2077c91340d',
      'Preserve original records', '2030-01-01', 8, ?2, ?3, 100)`)
    .bind(
      "a".repeat(64),
      corruptDigest ? "0".repeat(64) : snapshot.props.digest,
      snapshot.props.sourceJson,
    )
    .run()
  return { database, adapter: new GradeAwardArchiveReadAdapter({ env: { DB: database } }) }
}

test("旧台帳なしで原文・主体・確認日時を依頼IDと従業員IDから取得する", async () => {
  const f = await fixture()
  const record = await f.adapter.find("archive:one")
  expect(record).toMatchObject({
    actorAccountId: "a63d1b89-54f5-4001-8ed7-f2077c91340d",
    recordedAt: 100,
    observedOn: "2030-01-01",
    source: {
      awards: [
        {
          id: "9007199254740993",
          reason: " original ",
          createdAt: "unknown",
          observedDefinition: null,
        },
      ],
    },
  })
  expect(await f.adapter.findByEmployee("9e174baf-3240-4253-9cba-16bc3e431cca")).toEqual(record)
  expect(await f.adapter.find("missing")).toBeNull()
  expect(await f.adapter.findByEmployee("missing")).toBeNull()
})

test("原文のdigestが一致しない記録を返さない", async () => {
  const f = await fixture(true)
  expect(await f.adapter.find("archive:one")).toBeInstanceOf(Error)
  expect(await f.adapter.findByEmployee("9e174baf-3240-4253-9cba-16bc3e431cca")).toBeInstanceOf(
    Error,
  )
})
