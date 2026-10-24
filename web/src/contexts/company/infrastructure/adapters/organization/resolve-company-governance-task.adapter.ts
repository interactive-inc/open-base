import { CompanyDecisionParticipantsAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-decision-participants.adapter"
import { CompanyDecisionHumanAccountsAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-decision-human-accounts.adapter"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { ApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanyGovernanceScope } from "@/contexts/company/domain/policies/company-governance-authority.policy"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { CompanyGovernanceAuthorityResolutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-governance-authority-resolution.adapter"
import { CompanyGovernanceProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-governance-procedure-task.adapter"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { StartSystemProcedureTask } from "@system/domain/policies/decision-task.policy"

type Context = CompanyContext
type Input = Readonly<{
  step: ApplicationWorkflowStep
  payload: unknown
  subjectEmployeeId: EmployeeId | null
  excludedEmployeeIds: ReadonlySet<EmployeeId>
  openedAt: Date
  dueAt: Date | null
  resolvedAt: Date
}>

/** 公開Companyの資格を、業務台帳との対応と人のAccountを検査してTaskへ接続する。 */
export class ResolveCompanyGovernanceTaskAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolve(input: Input): Promise<
    | Readonly<{
        task: StartSystemProcedureTask
        guards: ReadonlyArray<D1PreparedStatement>
      }>
    | Error
  > {
    const authority = input.step.governance_authority
    if (authority === undefined) return new Error("Company governance authority is missing")
    const scope = this.scope(input)
    if (scope instanceof Error) return scope
    const asOf = resolveCompanyBusinessDate({
      now: input.resolvedAt.toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (asOf instanceof Error) return asOf
    const before = await new CompanyAuthoritySnapshotGuardAdapter({
      database: this.c.env.DB,
    }).prepare({ employeeCodes: [], accountIds: [] })
    if (before instanceof Error) return before
    const resolved = await new CompanyGovernanceAuthorityResolutionAdapter({
      repository: new D1CompanyResourceRepository({ database: this.c.env.DB }),
      readActiveAccountIds: (accountIds) =>
        new CompanyDecisionHumanAccountsAdapter({ database: this.c.env.DB }).findMany(
          accountIds,
          input.resolvedAt,
        ),
    }).resolve({
      organizationId: authority.organization_id,
      asOf: restoreCalendarDate(asOf),
      subjectEmployeeId: input.subjectEmployeeId,
      criteria: [{ responsibilityCode: authority.responsibility_code, scope }],
    })
    if (resolved.kind === "invalid") return resolved.error
    if (resolved.kind === "unavailable")
      return new Error("Company governance authority is unavailable", { cause: resolved.cause })
    const candidates = resolved.resolution.candidates.filter(
      (candidate) =>
        !input.excludedEmployeeIds.has(restoreWorkforceId("employee", candidate.employeeId)),
    )
    const after = await new CompanyAuthoritySnapshotGuardAdapter({
      database: this.c.env.DB,
    }).prepare({
      employeeCodes: [],
      accountIds: candidates.map((candidate) => zAccountId.parse(candidate.accountId)),
    })
    if (after instanceof Error) return after
    const participants = await new CompanyDecisionParticipantsAdapter(this.c).validate({
      candidates,
      asOf: restoreCalendarDate(asOf),
      resolvedAt: input.resolvedAt,
    })
    if (participants instanceof Error) return participants
    const task = await new CompanyGovernanceProcedureTaskAdapter().prepare({
      resolution: { ...resolved.resolution, candidates },
      criterionIndex: 0,
      taskKey: input.step.key,
      openedAt: input.openedAt,
      dueAt: input.dueAt,
    })
    if (task instanceof Error) return task
    if (input.step.rejection_behavior === "return" && task.returnPolicy === "forbidden") {
      return new Error("Company collective decisions cannot be returned")
    }
    return {
      task: {
        ...task,
        delegationPolicy: input.step.allow_delegation ? task.delegationPolicy : "forbidden",
        candidates: task.candidates.map((candidate) => ({
          ...candidate,
          resolvedAt: input.resolvedAt,
        })),
      },
      guards: [before, after],
    }
  }

  private scope(input: Input): CompanyGovernanceScope | null | Error {
    const scope = input.step.governance_authority?.scope
    if (scope === undefined) return new Error("Company governance scope is missing")
    if (scope === null) return null
    if (scope.scope_type === "region") return { scopeType: "region", regionCode: scope.region_code }
    if (scope.scope_type !== "amount")
      return { scopeType: scope.scope_type, scopeId: scope.scope_id }
    if (
      typeof input.payload !== "object" ||
      input.payload === null ||
      Array.isArray(input.payload) ||
      !Object.hasOwn(input.payload, scope.amount_field)
    )
      return new Error("approval amount is missing")
    const amount: unknown = Reflect.get(input.payload, scope.amount_field)
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0)
      return new Error("approval amount is invalid")
    return { scopeType: "amount", currencyCode: scope.currency_code, amount }
  }
}
