import { applicableWorkflowSteps } from "@/contexts/company/domain/policies/company-procedure-applicable-steps.policy"
import { ResolveCompanyGovernanceTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-governance-task.adapter"
import { dueAt } from "@/contexts/company/domain/definitions/company-procedure-due-at.definition"
import { ResolveCompanyProcedureTaskSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-procedure-task-snapshot.adapter"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import type { CompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import type { ApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { StartSystemProcedureTask } from "@system/domain/policies/decision-task.policy"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type CompanyProcedureApplicant = Readonly<{
  employeeId: EmployeeId
  employeeCode: string | null
  employmentStatus: string | null
  organizationUnitId: string | null
  organizationUnitCode: string | null
  organizationUnitName: string | null
  positionTitle: string | null
}>

export type ResolvedCompanyProcedureTask = Readonly<{
  key: string
  name: string
  rejectionBehavior: "reject" | "return"
  allowDelegation: boolean
  task: StartSystemProcedureTask
  guards: ReadonlyArray<D1PreparedStatement>
}>

/** Company policyを評価し、Systemへ渡せるAccount候補とopaque資格証拠だけを返す。 */
async function resolveCompanyProcedureTask(
  input: Readonly<{
    c: CompanyContext
    policy: CompanyProcedureDecisionPolicy
    payload: unknown
    applicant: CompanyProcedureApplicant
    activatedAt: Date
    afterTaskKey: string | null
    authoritySubjectEmployeeId?: EmployeeId | null
    targetDepartmentCode?: string | null
    excludedEmployeeIds?: ReadonlySet<EmployeeId>
  }>,
): Promise<ResolvedCompanyProcedureTask | null | Error> {
  if (input.policy.workflow === null) {
    return new Error("Company procedure requires an explicit authority workflow")
  }

  const steps = applicableWorkflowSteps({
    workflow: input.policy.workflow,
    payload: input.payload,
    applicant: input.applicant,
  })
  const previousIndex =
    input.afterTaskKey === null ? null : steps.findIndex((step) => step.key === input.afterTaskKey)
  if (previousIndex === -1) return new Error("current Company procedure task is unknown")
  const index = previousIndex === null ? 0 : previousIndex + 1
  if (index >= steps.length) return null
  const step = steps[index]
  if (step === undefined) return null

  return resolveConfiguredTask(input, step)
}

async function resolveConfiguredTask(
  input: Parameters<typeof resolveCompanyProcedureTask>[0],
  step: ApplicationWorkflowStep,
): Promise<ResolvedCompanyProcedureTask | Error> {
  const activatedAt = input.activatedAt.toISOString()
  if (step.governance_authority !== undefined) {
    const deadline = dueAt(activatedAt, step.due_days)
    const governance = await new ResolveCompanyGovernanceTaskAdapter(input.c).resolve({
      step,
      payload: input.payload,
      subjectEmployeeId:
        input.authoritySubjectEmployeeId === undefined
          ? input.applicant.employeeId
          : input.authoritySubjectEmployeeId,
      excludedEmployeeIds: new Set([
        input.applicant.employeeId,
        ...(input.excludedEmployeeIds ?? []),
      ]),
      openedAt: input.activatedAt,
      dueAt: deadline === null ? null : new Date(deadline),
      resolvedAt: input.activatedAt,
    })
    if (governance instanceof Error) return governance
    return {
      key: step.key,
      name: step.name,
      rejectionBehavior: step.rejection_behavior,
      allowDelegation: governance.task.delegationPolicy === "allowed",
      ...governance,
    }
  }
  const employeeCodes = [...step.approvers, ...step.escalation_approvers].flatMap((selector) =>
    selector.type === "employee" ? [selector.employee_code] : [],
  )
  const before = await new CompanyAuthoritySnapshotGuardAdapter({
    database: input.c.env.DB,
  }).prepare({
    employeeCodes,
    accountIds: [],
  })
  if (before instanceof Error) return before
  const snapshot = await new ResolveCompanyProcedureTaskSnapshotAdapter({
    c: input.c,
    applicantEmployeeId:
      input.authoritySubjectEmployeeId === undefined
        ? input.applicant.employeeId
        : input.authoritySubjectEmployeeId,
    step,
    activatedAt,
    excludedEmployeeIds: input.excludedEmployeeIds,
    targetDepartmentCode: input.targetDepartmentCode ?? null,
  }).resolveWorkflowStepSnapshot()
  if (snapshot instanceof Error) return snapshot
  const after = await new CompanyAuthoritySnapshotGuardAdapter({
    database: input.c.env.DB,
  }).prepare({
    employeeCodes,
    accountIds: snapshot.candidates.map((candidate) => candidate.accountId),
  })
  if (after instanceof Error) return after
  const candidates: StartSystemProcedureTask["candidates"][number][] = []
  for (const candidate of snapshot.candidates) {
    const evidence = CanonicalSystemJsonValue.create(JSON.parse(candidate.selectorsJson))
    if (evidence instanceof Error) return evidence
    const digest = await ProposalDigestValue.create(evidence)
    if (digest instanceof Error) return digest
    candidates.push({
      accountId: candidate.accountId,
      source: candidate.source,
      evidenceContext: "company",
      evidenceKind: "organizational-authority",
      evidenceId: snapshot.resolutionId,
      evidenceVersion: candidate.resolvedAt,
      eligibilityDigest: digest.toString(),
      eligibleFrom: candidate.eligibleFrom === null ? null : new Date(candidate.eligibleFrom),
      resolvedAt: new Date(candidate.resolvedAt),
    })
  }

  return {
    key: step.key,
    name: step.name,
    rejectionBehavior: step.rejection_behavior,
    allowDelegation: step.allow_delegation,
    guards: [before, after],
    task: {
      key: step.key,
      requiredApprovals: snapshot.requiredApprovals,
      openedAt: new Date(snapshot.activatedAt),
      dueAt: snapshot.dueAt === null ? null : new Date(snapshot.dueAt),
      candidates,
      excludedAccountIds: [],
    },
  }
}
type ResolveCompanyProcedureTaskAdapterContext = Readonly<{
  c: CompanyContext
  policy: CompanyProcedureDecisionPolicy
  payload: unknown
  applicant: CompanyProcedureApplicant
  activatedAt: Date
  afterTaskKey: string | null
  authoritySubjectEmployeeId?: EmployeeId | null
  targetDepartmentCode?: string | null
  excludedEmployeeIds?: ReadonlySet<EmployeeId>
}>
type Context = ResolveCompanyProcedureTaskAdapterContext

export class ResolveCompanyProcedureTaskAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolveCompanyProcedureTask(): Promise<ResolvedCompanyProcedureTask | null | Error> {
    return resolveCompanyProcedureTask(this.c)
  }
}
