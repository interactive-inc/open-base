import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import type { ProcedureKey } from "@system/domain/schemas/workflow/procedure-key.schema"
import type { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/parse-company-procedure-decision.policy"
import { ResolveCompanyProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-procedure-task.adapter"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { RecordRetirementProposalValue } from "@system/domain/values/records/record-retirement-proposal.value"

type Context = CompanyContext

/** 提案の操作と一致する公開手続きから会社上の判断候補を解決する。認証と原記録の権限は別途検査する。 */
export class PrepareCompanyRecordProcedureTaskAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      procedureKey: ProcedureKey
      proposal: RecordPreservationProposalValue | RecordRetirementProposalValue
      applicantAccountId: AccountId
      at: Date
    }>,
  ) {
    if (!Number.isSafeInteger(input.at.getTime()))
      return new CompanyForbiddenError("記録手続きの申請時点を確認できません", "forbidden")
    const operation =
      input.proposal instanceof RecordRetirementProposalValue
        ? "system.record.retire"
        : "system.record.preserve"
    const definition = await new SystemD1ProcedureRepository(this.c).find(input.procedureKey)
    if (definition instanceof Error) return definition
    if (definition === null || definition.completionOperationKey !== operation)
      return new CompanyForbiddenError("対象操作の手続きが公開されていません", "forbidden")
    const policy = parseCompanyProcedureDecisionPolicy(JSON.parse(definition.decisionPolicyJson))
    if (policy instanceof Error) return policy
    const applicantGuard = await new CompanyAuthoritySnapshotGuardAdapter({
      database: this.c.env.DB,
    }).prepare({ accountIds: [input.applicantAccountId], employeeCodes: [] })
    if (applicantGuard instanceof Error) return applicantGuard
    const applicants = await new CompanyEmployeeDirectoryReadAdapter({
      env: {
        DB: this.c.env.DB,
        COMPANY_TIME_ZONE: this.c.env.COMPANY_TIME_ZONE,
        NOW: input.at.toISOString(),
      },
    }).findForAccountIds([input.applicantAccountId])
    if (applicants instanceof Error) return applicants
    const applicant = applicants[0]?.employee
    if (applicant === undefined)
      return new CompanyForbiddenError("記録手続きの申請者をCompanyで確認できません", "forbidden")
    const resolved = await new ResolveCompanyProcedureTaskAdapter({
      c: this.c,
      policy,
      payload: JSON.parse(input.proposal.props.canonical.toString()),
      applicant: {
        employeeId: applicant.id,
        employeeCode: applicant.employeeCode,
        employmentStatus: applicant.employment?.status ?? null,
        organizationUnitId: applicant.primaryAssignment?.organizationUnitId ?? null,
        organizationUnitCode: applicant.primaryAssignment?.organizationUnitCode ?? null,
        organizationUnitName: applicant.primaryAssignment?.organizationUnitName ?? null,
        positionTitle: applicant.primaryAssignment?.positionTitle ?? null,
      },
      activatedAt: input.at,
      afterTaskKey: null,
      authoritySubjectEmployeeId: null,
      targetDepartmentCode: null,
    }).resolveCompanyProcedureTask()
    if (resolved instanceof Error) return resolved
    if (resolved === null)
      return new CompanyForbiddenError("記録手続きの判断候補を確認できません", "forbidden")
    return Object.freeze({
      definition,
      applicant,
      resolved: Object.freeze({ ...resolved, guards: [applicantGuard, ...resolved.guards] }),
    })
  }
}
