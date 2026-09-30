import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { readCompanyOrganizationRevision } from "@/contexts/company/interface/operations/read-company-organization-revision"
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
  return database
}

test("会社の現在の版を返し、初期化前の会社は0を返す", async () => {
  const database = await createDatabase()

  expect(
    await readCompanyOrganizationRevision({
      database,
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    }),
  ).toBe(7)
  expect(
    await readCompanyOrganizationRevision({
      database,
      organizationId: "01900060-0000-7000-8000-12268fccf2cc",
    }),
  ).toBe(0)
})

test("保存先を参照できない場合は0で補わず失敗を返す", async () => {
  const database = await createLocalD1Database({ schema: "" })

  expect(
    await readCompanyOrganizationRevision({
      database,
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    }),
  ).toBeInstanceOf(Error)
})
