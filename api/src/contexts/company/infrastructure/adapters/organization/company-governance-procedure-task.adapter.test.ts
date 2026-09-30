import { testDerivedId } from "@system/test/system-test-id.test-support"
import { CompanyGovernanceProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-governance-procedure-task.adapter"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyGovernanceAuthorityError } from "@/contexts/company/domain/errors"
import type {
  CompanyGovernanceAuthorityQualification,
  CompanyGovernanceAuthorityResolution,
} from "@/contexts/company/domain/policies/company-governance-authority.policy"
import { createSystemDecisionTask } from "@system/domain/policies/decision-task.policy"
import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { systemCaseIdSchema } from "@system/domain/schemas/workflow/system-case.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { describe, expect, test } from "bun:test"

const openedAt = new Date("2026-01-01T00:00:00.000Z")

describe("CompanyGovernanceProcedureTaskAdapter", () => {
  test("合議体の定足数・成立数・否決・委任方針をSystem Taskへ固定する", async () => {
    const resolution = collectiveResolution()
    const task = await new CompanyGovernanceProcedureTaskAdapter().prepare({
      resolution,
      criterionIndex: 0,
      taskKey: "governance-review",
      openedAt,
      dueAt: null,
    })

    expect(task).not.toBeInstanceOf(CompanyGovernanceAuthorityError)
    if (task instanceof CompanyGovernanceAuthorityError) return
    expect(task).toMatchObject({
      requiredApprovals: 2,
      requiredParticipants: 2,
      negativeDecisionRule: "approval-impossible",
      delegationPolicy: "forbidden",
      returnPolicy: "forbidden",
      excludedAccountIds: ["98cc1f96-23d3-43ad-857a-a7a808dd81b9"],
    })
    expect(task.candidates.map((candidate) => String(candidate.accountId))).toEqual([
      testDerivedId("account", "1"),
      testDerivedId("account", "2"),
      testDerivedId("account", "3"),
    ])
    expect(new Set(task.candidates.map((candidate) => candidate.eligibilityDigest)).size).toBe(3)

    const persistence = createSystemDecisionTask({
      task,
      caseId: systemCaseIdSchema.parse(testDerivedId("case", "governance")),
      createdByAccountId: zAccountId.parse(testDerivedId("account", "creator")),
      proposalDigest: proposalDigestSchema.parse("a".repeat(64)),
    })
    expect(persistence).not.toBeInstanceOf(Error)
    if (persistence instanceof Error) return
    expect(persistence.task).toMatchObject({
      requiredApprovals: 2,
      requiredParticipants: 2,
      negativeDecisionRule: "approval-impossible",
      delegationPolicy: "forbidden",
      returnPolicy: "forbidden",
    })
  })

  test("異なる責務assignmentや個人資格を一つの合議として混ぜずfail closedにする", async () => {
    const resolution = collectiveResolution()
    const first = resolution.candidates[0]
    if (first === undefined) throw new Error("candidate fixture is missing")
    const mixed: CompanyGovernanceAuthorityResolution = {
      ...resolution,
      candidates: [
        {
          ...first,
          qualifications: [
            ...first.qualifications,
            {
              ...qualification("assignment:individual"),
              holderType: "employee",
              holderId: first.employeeId,
              collectiveDecision: null,
            },
          ],
        },
        ...resolution.candidates.slice(1),
      ],
    }

    const task = await new CompanyGovernanceProcedureTaskAdapter().prepare({
      resolution: mixed,
      criterionIndex: 0,
      taskKey: "governance-review",
      openedAt,
      dueAt: null,
    })

    expect(task).toMatchObject({ code: "governance_authority_task_invalid" })
  })
})

function collectiveResolution(): CompanyGovernanceAuthorityResolution {
  return {
    snapshot: {
      schemaVersion: 1,
      source: "company-resource",
      asOf: restoreCalendarDate("2026-01-01"),
      organizationRevision: 7,
    },
    candidates: ["1", "2", "3"].map((suffix) => ({
      employeeId: testDerivedId("employee", suffix),
      accountId: testDerivedId("account", suffix),
      qualifications: [qualification("assignment:committee")],
    })),
    exclusions: [
      {
        employeeId: "941c55ea-bd99-4df1-b682-3301bea54b4e",
        accountId: "98cc1f96-23d3-43ad-857a-a7a808dd81b9",
        reason: "subject",
      },
    ],
  }
}

function qualification(assignmentId: string): CompanyGovernanceAuthorityQualification {
  return {
    criterionIndex: 0,
    responsibilityId: "responsibility:approve",
    responsibilityRevision: 1,
    assignmentId,
    assignmentRevision: 1,
    holderType: "collective-body",
    holderId: "body:committee",
    authorityScopeId: null,
    authorityScopeRevision: null,
    delegationAllowed: false,
    employmentId: "ae1dfa77-f4a1-4bd4-bb70-940db83597aa",
    employmentRevision: 1,
    accountEmployeeLinkId: "link:member",
    accountEmployeeLinkRevision: 1,
    collectiveDecision: {
      collectiveBodyId: "body:committee",
      votingMemberCount: 3,
      quorumRequired: 2,
      approvalRequired: 2,
      decisionRule: "majority",
    },
  }
}
