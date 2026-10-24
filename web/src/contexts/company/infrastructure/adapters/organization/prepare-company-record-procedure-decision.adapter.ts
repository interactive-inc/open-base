import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { RecordProcedureDecisionContext } from "@system/configuration/record-procedure-decision-context"
import {
  CompanyConflictError,
  CompanyForbiddenError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import { PrepareCompanyProcedureDecisionAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-procedure-decision.adapter"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"

type Context = CompanyContext
/** 記録の手続きを判断する人間のAccount対応と会社資格を固定する。 */
export class PrepareCompanyRecordProcedureDecisionAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async prepare(
    input: Parameters<RecordProcedureDecisionContext["prepareDecision"]>[0],
  ): ReturnType<RecordProcedureDecisionContext["prepareDecision"]> {
    const at = input.decidedAt
    const accountGuard = await new CompanyAuthoritySnapshotGuardAdapter({
      database: this.c.env.DB,
    }).prepare({
      accountIds: [input.actorAccountId],
      employeeCodes: [],
    })
    if (accountGuard instanceof Error) return new CompanyUnexpectedError("判断資格を取得できません")
    const employees = await new CompanyEmployeeDirectoryReadAdapter({
      env: {
        DB: this.c.env.DB,
        COMPANY_TIME_ZONE: this.c.env.COMPANY_TIME_ZONE,
        NOW: at.toISOString(),
      },
    }).findForAccountIds([input.actorAccountId])
    if (employees instanceof Error) return new CompanyUnexpectedError("判断資格を取得できません")
    const employee = employees[0]?.employee
    if (employee === undefined) return new CompanyForbiddenError("判断資格がありません")
    const decision = await new PrepareCompanyProcedureDecisionAdapter(this.c).prepare({
      proposal: input.proposal,
      decisionTarget: {
        proposalVersion: input.decisionTarget.proposalVersion,
        proposalDigest: input.decisionTarget.proposalDigest,
        taskKey: input.decisionTarget.taskKey,
        taskRound: input.decisionTarget.taskRound,
      },
      actorAccountId: input.actorAccountId,
      actorEmployeeId: employee.id,
      subjectEmployeeId: null,
      targetDepartmentCode: null,
      excludedEmployeeIds: new Set(),
      action: input.action,
      decidedAt: at,
    })
    if (decision instanceof CompanyConflictError) return decision
    if (decision instanceof Error) return new CompanyForbiddenError("判断資格がありません")
    const action = decision.action
    if (action !== "approve" && action !== "reject" && action !== "return")
      return new CompanyUnexpectedError("判断操作を確認できません")
    return { ...decision, action, guards: [accountGuard, ...decision.guards] }
  }
}
