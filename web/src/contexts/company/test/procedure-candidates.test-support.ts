import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

/** 従業員codeは投影tableではなく公開Company変更として準備する。 */
export async function createProcedureCandidatesTestContext() {
  const fixture = await createGovernanceTaskTestContext()
  const snapshot = await new D1CompanyResourceRepository({ database: fixture.database }).findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    types: ["employee"],
  })
  if (!snapshot.ok) throw snapshot.cause
  await fixture.write(
    snapshot.resources.map((employee) => ({
      ...employee,
      revision: employee.revision + 1,
      attributes: {
        ...employee.attributes,
        employeeCode:
          employee.id === fixture.creator.employeeId
            ? "APPLICANT"
            : `REVIEWER_${fixture.people.findIndex((person) => person.employeeId === employee.id)}`,
      },
    })),
  )
  const reviewer = fixture.people[1]
  if (reviewer === undefined) throw new Error("reviewer fixture missing")
  const root = await fixture.database
    .prepare(
      "SELECT organization_unit_id FROM company_organization_unit_period_versions WHERE kind = 'COMPANY' AND is_void = 0 ORDER BY revision DESC LIMIT 1",
    )
    .first<string>("organization_unit_id")
  const revision = await fixture.database
    .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
    .first<number>("revision")
  if (root === null || revision === null) throw new Error("organization fixture missing")
  const startsOn = resolveCompanyBusinessDate({
    now: fixture.at.toISOString(),
    timeZone: "Asia/Tokyo",
  })
  if (startsOn instanceof Error) throw startsOn
  const operationId = crypto.randomUUID()
  const periods: D1PreparedStatement[] = []
  for (const person of [fixture.creator, reviewer]) {
    const employmentId = await fixture.database
      .prepare("SELECT id FROM company_employments WHERE employee_id = ?1")
      .bind(person.employeeId)
      .first<string>("id")
    if (employmentId === null) throw new Error("employment fixture missing")
    periods.push(
      fixture.database
        .prepare(`INSERT INTO company_organization_assignment_period_versions
        (period_id, revision, employment_id, employee_id, organization_unit_id, assignment_type, position_title, manager_employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
        VALUES (?1, 1, ?2, ?3, ?4, 'PRIMARY', NULL, NULL, ?6, NULL, 0, ?5, 0)`)
        .bind(crypto.randomUUID(), employmentId, person.employeeId, root, operationId, startsOn),
      fixture.database
        .prepare(`INSERT INTO company_organization_responsibility_period_versions
        (period_id, revision, employment_id, employee_id, organization_unit_id, responsibility_type, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
        VALUES (?1, 1, ?2, ?3, ?4, 'APPROVE', ?6, NULL, 0, ?5, 0)`)
        .bind(crypto.randomUUID(), employmentId, person.employeeId, root, operationId, startsOn),
    )
  }
  // 既存の期間fixtureと同じoperationで所属・責務を一括記録し、triggerの整合性検査を通す。
  await fixture.database.batch([
    fixture.database
      .prepare(`INSERT INTO company_organization_change_operations
      (id, expected_revision, change_count, applied_count, resulting_revision, status, recorded_at, actor_account_id, reason, evidence_references_json, request_fingerprint)
      VALUES (?1, ?2, ?3, 0, ?2 + ?3, 'PENDING', 0, ?4, 'Confirm review responsibilities', '[]', ?5)`)
      .bind(operationId, revision, periods.length, fixture.creator.accountId, "0".repeat(64)),
    ...periods,
    fixture.database
      .prepare(
        "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = ?1",
      )
      .bind(operationId),
  ])
  return { ...fixture, reviewer }
}
