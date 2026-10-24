import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function legacyLinks(database: D1Database) {
  const rows = await database
    .prepare(
      "SELECT account_id, employee_id FROM company_account_employee_links ORDER BY account_id",
    )
    .all<{ account_id: string; employee_id: string }>()
  return rows.results.map((row) => `${row.account_id}=${row.employee_id}`)
}

test("公開したAccountと従業員の対応を手書きの挿入なしで対応表へ投影する", async () => {
  const c = await createGovernanceTaskTestContext()
  const published = c.resources
    .filter((resource) => resource.type === "account-employee-link")
    .map((resource) => `${resource.attributes.accountId}=${resource.attributes.employeeId}`)
    .toSorted()

  expect(published.length).toBeGreaterThan(1)
  expect(await legacyLinks(c.database)).toEqual(published)
})

test("同じ対の再公開は対応表を変えず、別の相手への付け替えは全体を中断する", async () => {
  const c = await createGovernanceTaskTestContext()
  const links = c.resources.filter((resource) => resource.type === "account-employee-link")
  const first = links[0]
  const second = links[1]
  if (first === undefined || second === undefined) throw new Error("link fixtures are missing")
  const before = await legacyLinks(c.database)

  await c.write([{ ...first, revision: 2 }])
  expect(await legacyLinks(c.database)).toEqual(before)

  await execSql(c.database, "DROP TRIGGER company_account_employee_resource_owner_guard")
  const revision = await c.database
    .prepare(
      `SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
    )
    .first<number>("revision")
  await expect(
    c.write([
      {
        ...first,
        revision: 3,
        attributes: { ...first.attributes, employeeId: second.attributes.employeeId },
      },
    ]),
  ).rejects.toThrow()
  expect(await legacyLinks(c.database)).toEqual(before)
  expect(
    await c.database
      .prepare(
        `SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
      )
      .first<number>("revision"),
  ).toBe(revision)
})
