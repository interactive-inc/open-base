import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { prepareCompanyOrganizationRevisionStatement } from "@/contexts/company/interface/operations/prepare-company-organization-revision-statement"
import { readCompanyOrganizationLifecycleRevision } from "@/contexts/company/interface/operations/read-company-organization-lifecycle-revision"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function createDatabase(): Promise<D1Database> {
  const database = await createLocalD1Database({ schema: "" })
  await execSql(
    database,
    "CREATE TABLE company_organizations (id TEXT PRIMARY KEY, revision INTEGER NOT NULL)",
  )
  await execSql(
    database,
    `INSERT INTO company_organizations VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 7)`,
  )
  await execSql(
    database,
    "CREATE TABLE company_organization_lifecycle_states (id INTEGER PRIMARY KEY, revision INTEGER)",
  )
  await execSql(database, "CREATE TABLE effects (id INTEGER PRIMARY KEY)")
  return database
}

function guard(database: D1Database, organizationId: string, expectedRevision: number) {
  const statement = prepareCompanyOrganizationRevisionStatement({
    database,
    organizationId,
    expectedRevision,
  })
  if (statement instanceof Error) throw statement
  return statement
}

test("会社版が一致すれば同じbatchの書込みを確定する", async () => {
  const database = await createDatabase()

  await database.batch([
    guard(database, COMPANY_DEFAULT_ORGANIZATION_ID, 7),
    database.prepare("INSERT INTO effects VALUES (1)"),
  ])

  expect(await database.prepare("SELECT count(*) AS n FROM effects").first<number>("n")).toBe(1)
})

test("会社版の不一致と組織の不在では、同じbatchの書込みを全体で戻す", async () => {
  const database = await createDatabase()

  for (const [organizationId, revision] of [
    [COMPANY_DEFAULT_ORGANIZATION_ID, 6],
    ["01900060-0000-7000-8000-12268fccf2cc", 7],
  ] as const)
    await expect(
      database.batch([
        database.prepare("INSERT INTO effects VALUES (2)"),
        guard(database, organizationId, revision),
      ]),
    ).rejects.toThrow("malformed JSON")

  expect(await database.prepare("SELECT count(*) AS n FROM effects").first<number>("n")).toBe(0)
})

test("不正な組織IDと版を拒否する", async () => {
  const database = await createDatabase()

  expect(
    prepareCompanyOrganizationRevisionStatement({
      database,
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      expectedRevision: -1,
    }),
  ).toBeInstanceOf(Error)
  expect(
    prepareCompanyOrganizationRevisionStatement({
      database,
      organizationId: "",
      expectedRevision: 1,
    }),
  ).toBeInstanceOf(Error)
})

test("期間台帳の版を返し、未作成はnull、参照できない場合は失敗を返す", async () => {
  const database = await createDatabase()

  expect(await readCompanyOrganizationLifecycleRevision({ database })).toBeNull()
  await database.prepare("INSERT INTO company_organization_lifecycle_states VALUES (1, 12)").run()
  expect(await readCompanyOrganizationLifecycleRevision({ database })).toBe(12)
  expect(
    await readCompanyOrganizationLifecycleRevision({
      database: await createLocalD1Database({ schema: "" }),
    }),
  ).toBeInstanceOf(Error)
})
