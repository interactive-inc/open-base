import { expect, setDefaultTimeout, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { createCompanyEmployerTestContext } from "@/contexts/company/test/company-employer.test-support"
import { prepareHistoricalCompanyResourceRevisionFixture } from "@/contexts/company/test/historical-company-resource-revision.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const filename = readdirSync(COMPANY_TEST_MIGRATIONS_DIR).find((name) =>
  name.endsWith("_guard_company_employment_contract_terms.sql"),
)
if (filename === undefined) throw new Error("Contract term migration missing")
const migration = readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, filename), "utf8")
const minimalSchema = `CREATE TABLE company_resource_revisions (
  organization_id TEXT, resource_type TEXT, resource_id TEXT, revision INTEGER, attributes_json TEXT
);`

test.each([false, true])("実製品の既存履歴を保全してD1のbatchで移行する: %s", async (invalid) => {
  const files = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
  const cutover = files.indexOf(filename)
  expect(cutover).toBeGreaterThan(0)
  const database = await createLocalD1Database({
    schema: files
      .slice(0, cutover)
      .map((name) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, name), "utf8"))
      .join("\n"),
  })
  await prepareHistoricalCompanyResourceRevisionFixture(database)
  const f = await createCompanyEmployerTestContext(database)
  const invalidInsert = database
    .prepare(`INSERT INTO company_resource_revisions
      (organization_id, resource_type, resource_id, revision, organization_revision, state,
       effective_from, effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at)
      SELECT organization_id, resource_type, resource_id, revision + 1,
        (SELECT revision + 1 FROM company_organizations WHERE id = organization_id), state,
        effective_from, effective_to, json_set(attributes_json, '$.contractTerm', json(?)),
        'contract:invalid-before-migration', actor_account_id, reason, recorded_at
      FROM company_resource_revisions WHERE resource_type = 'employment' AND resource_id = ?
      ORDER BY revision DESC LIMIT 1`)
    .bind('{"kind":"FIXED_TERM"}', f.employment.id)
  if (invalid) await invalidInsert.run()
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
          "SELECT name FROM sqlite_master WHERE name = 'company_employment_contract_term_violations'",
        )
        .first(),
    ).toBeNull()
  } else {
    expect(applied).not.toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT count(*) AS count FROM company_employment_contract_term_violations")
        .first<{ count: number }>(),
    ).toEqual({ count: 0 })
    const rejected = await invalidInsert.run().catch((cause: unknown) => cause)
    expect(rejected).toBeInstanceOf(Error)
    if (!(rejected instanceof Error)) throw new Error("Invalid contract was inserted")
    expect(rejected.message).toContain("company_employment_contract_term_invalid")
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
})

test("共有Company DDLに製品の契約期間マイグレーションを含む", () => {
  expect(
    readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8"),
  ).toContain(migration)
  expect(splitSqlStatements(migration)).toHaveLength(3)
})

test("SQLも不明・無期・有期を区別し、不正な期間と属性を直接保存できない", () => {
  const database = new Database(":memory:")
  try {
    database.exec(minimalSchema)
    database.exec(migration)
    const insert = database.prepare(
      "INSERT INTO company_resource_revisions VALUES ('company:1', 'employment', 'employment:1', 1, ?)",
    )
    for (const attributes of [
      {},
      { contractTerm: null },
      { contractTerm: { kind: "INDEFINITE", startsOn: "2026-01-01" } },
      { contractTerm: { kind: "FIXED_TERM", startsOn: "2026-01-01", endsBefore: "2026-01-02" } },
    ]) {
      expect(() => insert.run(JSON.stringify(attributes))).not.toThrow()
    }
    for (const contractTerm of [
      "INDEFINITE",
      {},
      [],
      { kind: "UNKNOWN", startsOn: "2026-01-01" },
      { kind: "INDEFINITE" },
      { kind: "INDEFINITE", startsOn: "2026-02-30" },
      { kind: "INDEFINITE", startsOn: "2026-01-01", endsBefore: null },
      { kind: "FIXED_TERM", startsOn: "2026-01-01" },
      { kind: "FIXED_TERM", startsOn: "2026-01-01", endsBefore: null },
      { kind: "FIXED_TERM", startsOn: "2026-01-01", endsBefore: "2026-01-01" },
      { kind: "FIXED_TERM", startsOn: "2026-01-02", endsBefore: "2026-01-01" },
      { kind: "FIXED_TERM", startsOn: "2026-01-01", endsBefore: "2026-02-30" },
      { kind: "INDEFINITE", startsOn: "2026-01-01", automaticallyTerminate: true },
    ]) {
      expect(() => insert.run(JSON.stringify({ contractTerm }))).toThrow(
        "company_employment_contract_term_invalid",
      )
    }
    expect(
      database.prepare("SELECT count(*) AS count FROM company_resource_revisions").get(),
    ).toEqual({ count: 4 })
  } finally {
    database.close()
  }
})

test.each([false, true])("既存履歴を変更せず、不整合時は移行を取り消す: %s", (invalid) => {
  const database = new Database(":memory:")
  try {
    database.exec(minimalSchema)
    database
      .prepare(
        "INSERT INTO company_resource_revisions VALUES ('company:1', 'employment', 'employment:1', 1, ?)",
      )
      .run(JSON.stringify(invalid ? { contractTerm: { kind: "FIXED_TERM" } } : {}))
    const before = database.prepare("SELECT * FROM company_resource_revisions").all()
    const apply = database.transaction(() => {
      for (const statement of splitSqlStatements(migration)) database.prepare(statement).all()
    })
    if (invalid) {
      expect(apply).toThrow()
      expect(
        database
          .prepare(
            "SELECT name FROM sqlite_master WHERE name = 'company_employment_contract_term_violations'",
          )
          .get(),
      ).toBeNull()
    } else {
      expect(apply).not.toThrow()
    }
    expect(database.prepare("SELECT * FROM company_resource_revisions").all()).toEqual(before)
  } finally {
    database.close()
  }
})
