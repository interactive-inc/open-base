import { expect, test } from "bun:test"
import { createProcedureCandidatesTestContext } from "@/contexts/company/test/procedure-candidates.test-support"
import {
  zApplicationWorkflowStep,
  zWorkflowApproverSelector,
} from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { ResolveCompanyProcedureApproverMatchesAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-procedure-approver-matches.adapter"

test("every accepted selector resolves a canonical candidate with its original index", async () => {
  const fixture = await createProcedureCandidatesTestContext()
  const root = await fixture.database
    .prepare(`SELECT organization_unit_id, code
      FROM company_organization_unit_period_versions
      WHERE kind = 'COMPANY' AND is_void = 0 ORDER BY revision DESC LIMIT 1`)
    .first<{ organization_unit_id: string; code: string }>()
  const revision = await fixture.database
    .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
    .first<number>("revision")
  if (root === null || revision === null) {
    throw new Error("organization fixture is missing")
  }

  const operationId = crypto.randomUUID()

  await fixture.database.batch([
    fixture.database
      .prepare(`INSERT INTO company_organization_change_operations
        (id, expected_revision, change_count, applied_count, resulting_revision, status, recorded_at, actor_account_id, reason, evidence_references_json, request_fingerprint)
        VALUES (?1, ?2, 2, 0, ?2 + 2, 'PENDING', 0, ?3, 'Confirm review manager', '[]', ?4)`)
      .bind(operationId, revision, fixture.creator.accountId, "0".repeat(64)),
    fixture.database
      .prepare(`INSERT INTO company_organization_assignment_period_versions
        (period_id, revision, employment_id, employee_id, organization_unit_id, assignment_type, position_title, manager_employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
        SELECT period_id, revision + 1, employment_id, employee_id, organization_unit_id, assignment_type, position_title, ?1, starts_on, ends_on, is_void, ?2, 0
        FROM company_organization_assignment_period_versions
        WHERE employee_id = ?3 AND revision = 1`)
      .bind(fixture.reviewer.employeeId, operationId, fixture.creator.employeeId),
    fixture.database
      .prepare(`INSERT INTO company_organization_responsibility_period_versions
        (period_id, revision, employment_id, employee_id, organization_unit_id, responsibility_type, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
        SELECT ?1, 1, employment_id, employee_id, organization_unit_id, 'MANAGER', starts_on, NULL, 0, ?2, 0
        FROM company_organization_assignment_period_versions
        WHERE employee_id = ?3 AND revision = 1`)
      .bind(crypto.randomUUID(), operationId, fixture.reviewer.employeeId),
    fixture.database
      .prepare(
        "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = ?1",
      )
      .bind(operationId),
  ])

  const selectors = zWorkflowApproverSelector
    .array()
    .parse([
      { type: "employee", employee_code: "REVIEWER_1" },
      { type: "direct_manager" },
      { type: "department_manager" },
      { type: "target_department_manager" },
      { type: "responsibility", responsibility_type: "MANAGER", organization_unit_code: null },
      { type: "responsibility", responsibility_type: "MANAGER", organization_unit_code: root.code },
      { type: "management_chain" },
    ])

  expect(new Set(selectors.map((selector) => selector.type))).toEqual(
    new Set(zWorkflowApproverSelector.options.map((option) => option.shape.type.value)),
  )

  const step = zApplicationWorkflowStep.parse({
    key: "review",
    name: "Review",
    approvers: selectors,
    escalation_approvers: selectors,
  })

  for (const candidateSelectors of [step.approvers, step.escalation_approvers]) {
    const matches = await new ResolveCompanyProcedureApproverMatchesAdapter({
      c: fixture.context,
      applicantEmployeeId: fixture.creator.employeeId,
      selectors: candidateSelectors,
      resolvedAt: fixture.at.toISOString(),
      targetDepartmentCode: root.code,
    }).resolveWorkflowApproverMatches()

    if (matches instanceof Error) throw matches

    expect(matches.map((match) => match.provenance.selector_index)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(matches.map((match) => match.provenance.selector)).toEqual(candidateSelectors)

    for (const match of matches) {
      expect(match.employeeId).toBe(fixture.reviewer.employeeId)
      expect(match.accountId).toBe(fixture.reviewer.accountId)
      expect(match.provenance.evidence.authority_snapshot).toMatchObject({
        source: "lifecycle",
        organization_revision: revision + 2,
      })
    }
  }
})
