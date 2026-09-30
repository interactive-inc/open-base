import { OrganizationWorkforceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-workforce-snapshot.adapter"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

/**
 * 全社の労働力 snapshot が返す従業員の氏名、従業員 code、連絡先の正本を固定する。
 *
 * 公開履歴へ接続済みの従業員は公開 resource、未接続の従業員は接続までの原記録である従業員の表を読む。
 */
test("労働力 snapshot の従業員の値は公開した Person と従業員の resource と一致する", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  await f.assignEmployeeCode(f.creator.employeeId, "EMPLOYEE-001")
  const snapshot = await new OrganizationWorkforceSnapshotAdapter(f.context).readAllSnapshot()
  if (!snapshot.ok) throw snapshot.cause
  const schedule = snapshot.schedules.find(
    (candidate) => candidate.employee.id === f.creator.employeeId,
  )
  if (schedule === undefined) throw new Error("creator schedule is missing")

  const published = await f.database
    .prepare(
      `SELECT json_extract(person.attributes_json, '$.officialName') AS official_name,
              json_extract(employee.attributes_json, '$.employeeCode') AS employee_code,
              json_extract(person.attributes_json, '$.email') AS email,
              json_extract(person.attributes_json, '$.phone') AS phone
       FROM company_resource_heads AS employee_head
       JOIN company_resource_revisions AS employee
         ON employee.organization_id = employee_head.organization_id
        AND employee.resource_type = employee_head.resource_type
        AND employee.resource_id = employee_head.resource_id
        AND employee.revision = employee_head.revision
       JOIN company_resource_heads AS person_head
         ON person_head.organization_id = employee.organization_id
        AND person_head.resource_type = 'person'
        AND person_head.resource_id = json_extract(employee.attributes_json, '$.personId')
       JOIN company_resource_revisions AS person
         ON person.organization_id = person_head.organization_id
        AND person.resource_type = person_head.resource_type
        AND person.resource_id = person_head.resource_id
        AND person.revision = person_head.revision
       WHERE employee_head.resource_type = 'employee' AND employee_head.resource_id = ?1`,
    )
    .bind(f.creator.employeeId)
    .first<{
      official_name: string
      employee_code: string | null
      email: string | null
      phone: string | null
    }>()
  if (published === null) throw new Error("published employee is missing")

  expect(schedule.employee).toEqual({
    id: f.creator.employeeId,
    officialName: published.official_name,
    employeeCode: published.employee_code,
    email: published.email,
    phone: published.phone,
  })
  expect(schedule.employee.employeeCode).toBe("EMPLOYEE-001")
  expect(snapshot.schedules.length).toBeGreaterThan(0)
})

test("公開履歴へ接続済みの従業員は、表の列が食い違っても公開 resource の値を読む", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  await f.database
    .prepare("UPDATE company_employees SET official_name = 'Stale Table Name' WHERE id = ?1")
    .bind(f.creator.employeeId)
    .run()
  const snapshot = await new OrganizationWorkforceSnapshotAdapter(f.context).readAllSnapshot()
  if (!snapshot.ok) throw snapshot.cause

  expect(
    snapshot.schedules.find((candidate) => candidate.employee.id === f.creator.employeeId)?.employee
      .officialName,
  ).not.toBe("Stale Table Name")
})

test("公開履歴へ未接続の従業員は、接続までの原記録として表の値を読む", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  await f.database
    .prepare(
      `INSERT INTO company_employees (id, official_name, employee_code, email, phone, created_at, updated_at)
       VALUES ('31cf526f-0921-48a3-be38-c1458aaf2671', 'Unconnected Person', 'LEGACY-9', 'you@example.com', NULL, 0, 0)`,
    )
    .run()
  const snapshot = await new OrganizationWorkforceSnapshotAdapter(f.context).readAllSnapshot()
  if (!snapshot.ok) throw snapshot.cause

  expect(
    snapshot.schedules.find(
      (candidate) => String(candidate.employee.id) === "31cf526f-0921-48a3-be38-c1458aaf2671",
    )?.employee,
  ).toMatchObject({
    officialName: "Unconnected Person",
    employeeCode: "LEGACY-9",
    email: "you@example.com",
    phone: null,
  })
})
