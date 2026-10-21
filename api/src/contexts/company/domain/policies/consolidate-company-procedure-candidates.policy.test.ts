import { expect, test } from "bun:test"
import { consolidateCompanyProcedureCandidates } from "@/contexts/company/domain/policies/consolidate-company-procedure-candidates.policy"
import type { WorkflowStepCandidateSnapshot } from "@/contexts/company/domain/definitions/company-procedure-step-snapshot.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

const primary: WorkflowStepCandidateSnapshot = {
  employeeId: restoreWorkforceId("employee", "employee:reviewer"),
  accountId: zAccountId.parse("3c9d7e5f-1a2b-4c3d-8e4f-5a6b7c8d9e0f"),
  source: "primary",
  selectorsJson: JSON.stringify([
    {
      selector_index: 0,
      selector: { type: "employee", employee_code: "REVIEWER" },
      evidence: { kind: "employee" },
    },
  ]),
  eligibleFrom: null,
  resolvedAt: "2026-01-01T00:00:00.000Z",
}
const escalation: WorkflowStepCandidateSnapshot = {
  ...primary,
  source: "escalation",
  eligibleFrom: "2026-01-02T00:00:00.000Z",
  selectorsJson: JSON.stringify([
    {
      selector_index: 0,
      selector: {
        type: "responsibility",
        responsibility_type: "APPROVE",
        organization_unit_code: null,
      },
      evidence: { kind: "responsibility" },
    },
  ]),
}

test("overlapping Account retains primary eligibility and both selector evidence", () => {
  const candidates = consolidateCompanyProcedureCandidates([primary, escalation])
  expect(candidates).toHaveLength(1)
  expect(candidates[0]).toEqual({
    ...primary,
    selectorsJson: JSON.stringify([
      ...JSON.parse(primary.selectorsJson),
      ...JSON.parse(escalation.selectorsJson),
    ]),
  })
})

test("primary eligibility wins even when escalation is encountered first", () => {
  const candidates = consolidateCompanyProcedureCandidates([escalation, primary])
  expect(candidates).toHaveLength(1)
  expect(candidates[0]?.source).toBe("primary")
  expect(candidates[0]?.eligibleFrom).toBeNull()
})

test("distinct Accounts retain ordering and unchanged evidence", () => {
  const other = {
    ...escalation,
    accountId: zAccountId.parse("4c9d7e5f-1a2b-4c3d-8e4f-5a6b7c8d9e0f"),
  }
  expect(consolidateCompanyProcedureCandidates([primary, other])).toEqual([primary, other])
})

test("same selector overlap is consolidated without losing either qualification", () => {
  const candidates = consolidateCompanyProcedureCandidates([
    primary,
    { ...escalation, selectorsJson: primary.selectorsJson },
  ])
  expect(candidates).toHaveLength(1)
  expect(JSON.parse(candidates[0]?.selectorsJson ?? "[]")).toHaveLength(2)
})
