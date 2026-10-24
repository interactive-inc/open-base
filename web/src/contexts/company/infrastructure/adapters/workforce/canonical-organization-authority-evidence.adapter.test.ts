import { testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { expect, test } from "bun:test"
import type {
  OrganizationalAuthorityAssignmentManagementEvidence,
  OrganizationalAuthorityReportingRelationEvidence,
} from "@/contexts/company/domain/definitions/organizational-authority.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { CanonicalOrganizationAuthorityEvidenceAdapter } from "@/contexts/company/infrastructure/adapters/workforce/canonical-organization-authority-evidence.adapter"

const assignment: OrganizationalAuthorityAssignmentManagementEvidence = {
  employeeId: restoreWorkforceId("employee", testLiteralId("employee-subject")),
  managerEmployeeId: restoreWorkforceId("employee", testLiteralId("employee-manager")),
  organizationUnitId: restoreWorkforceId("organization_unit", testLiteralId("unit-product")),
  assignmentPeriodId: restoreWorkforceId("period", testLiteralId("assignment-subject")),
  assignmentRevision: 3,
  asOf: restoreCalendarDate("2026-06-01"),
}
const relation: OrganizationalAuthorityReportingRelationEvidence = {
  employeeId: assignment.managerEmployeeId,
  managerEmployeeId: restoreWorkforceId("employee", testLiteralId("employee-executive")),
  organizationUnitId: assignment.organizationUnitId,
  reportingRelationId: "relation-manager",
  reportingRelationRevision: 2,
  asOf: assignment.asOf,
}

test("keeps the existing assignment evidence wire contract", () => {
  expect(
    new CanonicalOrganizationAuthorityEvidenceAdapter({
      kind: "direct_manager",
      assignment,
    }).serialize(),
  ).toEqual({
    type: "lifecycle_assignment",
    employee_id: testLiteralId("employee-subject"),
    manager_employee_id: testLiteralId("employee-manager"),
    organization_unit_id: testLiteralId("unit-product"),
    assignment_period_id: testLiteralId("assignment-subject"),
    assignment_revision: 3,
    as_of: "2026-06-01",
  })
})

test("serializes an independent relation without claiming assignment provenance", () => {
  expect(
    new CanonicalOrganizationAuthorityEvidenceAdapter({
      kind: "direct_manager",
      reportingRelation: relation,
    }).serialize(),
  ).toEqual({
    type: "reporting_relation",
    employee_id: testLiteralId("employee-manager"),
    manager_employee_id: testLiteralId("employee-executive"),
    organization_unit_id: testLiteralId("unit-product"),
    reporting_relation_id: "relation-manager",
    reporting_relation_revision: 2,
    as_of: "2026-06-01",
  })
})

test("preserves the source of every edge in a mixed management path", () => {
  expect(
    new CanonicalOrganizationAuthorityEvidenceAdapter({
      kind: "management_chain",
      path: [assignment, relation],
    }).serialize(),
  ).toEqual({
    type: "management_chain",
    path: [
      {
        employee_id: testLiteralId("employee-subject"),
        manager_employee_id: testLiteralId("employee-manager"),
        organization_unit_id: testLiteralId("unit-product"),
        assignment_period_id: testLiteralId("assignment-subject"),
        assignment_revision: 3,
        as_of: "2026-06-01",
      },
      {
        employee_id: testLiteralId("employee-manager"),
        manager_employee_id: testLiteralId("employee-executive"),
        organization_unit_id: testLiteralId("unit-product"),
        reporting_relation_id: "relation-manager",
        reporting_relation_revision: 2,
        as_of: "2026-06-01",
      },
    ],
  })
})
