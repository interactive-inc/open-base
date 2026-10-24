import { companyEmployeeProfileSql } from "@/contexts/company/infrastructure/adapters/employee/lib/company-employee-profile-sql"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function profile(database: D1Database, employeeId: string) {
  return database
    .prepare(
      `${companyEmployeeProfileSql()}
       SELECT official_name, employee_code, email, phone FROM employee_profiles WHERE id = ?2`,
    )
    .bind("2030-06-01", employeeId)
    .first<Record<string, string | null>>()
}

test("接続済みの従業員は、表の列が食い違っても公開 resource の値を返す", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  const published = await profile(f.database, f.creator.employeeId)
  await f.database
    .prepare("UPDATE company_employees SET official_name = 'Stale Table Name' WHERE id = ?1")
    .bind(f.creator.employeeId)
    .run()

  expect(published?.official_name).toMatch(/\S/)
  expect(await profile(f.database, f.creator.employeeId)).toEqual(published)
})

test("未接続の従業員は、接続までの原記録である表の値を返す", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  await f.database
    .prepare(
      `INSERT INTO company_employees (id, official_name, employee_code, email, phone, created_at, updated_at)
       VALUES ('31cf526f-0921-48a3-be38-c1458aaf2671', 'Unconnected Person', 'LEGACY-9', 'you@example.com', NULL, 0, 0)`,
    )
    .run()

  expect(await profile(f.database, "31cf526f-0921-48a3-be38-c1458aaf2671")).toEqual({
    official_name: "Unconnected Person",
    employee_code: "LEGACY-9",
    email: "you@example.com",
    phone: null,
  })
})
