import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { companyOrganizations } from "@/contexts/company/infrastructure/schema/company"
import { prepareCompanyOrganizationRevisionGuard } from "@/contexts/company/interface/operations/prepare-company-organization-revision-guard"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("Company 版の競合と組織不在で他 context の batch 書込を戻す", async () => {
  const database = await createLocalD1Database({
    schema:
      readFileSync(
        new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
        "utf8",
      ) +
      "\n" +
      readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8"),
  })
  await database
    .prepare(`INSERT INTO company_organizations
      (id, revision, name, representative_name, created_at, updated_at)
      VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 1, 'Before', '', 1, 1)`)
    .run()
  const orm = drizzle(database)
  const write = orm
    .update(companyOrganizations)
    .set({ name: "After" })
    .where(eq(companyOrganizations.id, COMPANY_DEFAULT_ORGANIZATION_ID))
  const guard = (
    expectedRevision: number,
    organizationId: string = COMPANY_DEFAULT_ORGANIZATION_ID,
  ) => {
    const statement = prepareCompanyOrganizationRevisionGuard({
      database,
      organizationId,
      expectedRevision,
    })
    if (statement instanceof Error) throw statement
    return statement
  }
  const name = () =>
    database
      .prepare(
        `SELECT name FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
      )
      .first<string>("name")

  await expect(orm.batch([guard(0), write])).rejects.toThrow("company_revision_conflict")
  expect(await name()).toBe("Before")

  await expect(
    orm.batch([guard(1, "01900060-0000-7000-8000-9f96a06e569f"), write]),
  ).rejects.toThrow("company_revision_conflict")
  expect(await name()).toBe("Before")

  await orm.batch([guard(1), write])
  expect(await name()).toBe("After")
})
