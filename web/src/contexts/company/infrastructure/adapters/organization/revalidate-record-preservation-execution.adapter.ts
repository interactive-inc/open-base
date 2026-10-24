import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"
import { RevalidateCompanyProcedureExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-execution.adapter"

type Context = CompanyContext

/** 記録保全の提案に対する会社上の承認資格を再検査する。移管元へのアクセス権は別途検査する。 */
export class RevalidateRecordPreservationExecutionAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      applicationId: number
      caseId: string
      seriesId: string
      proposal: RecordPreservationProposalValue
      executorAccountId: AccountId
      executedAt: Date
    }>,
  ) {
    const finalization = input.proposal.toFinalization({
      actorAccountId: input.executorAccountId,
      at: input.executedAt,
    })
    if (finalization instanceof Error)
      return new CompanyForbiddenError("記録保全の実行内容を確認できません", "forbidden", {
        cause: finalization,
      })
    return new RevalidateCompanyProcedureExecutionAdapter(this.c).prepareApprovedEvidence({
      applicationId: input.applicationId,
      expectedCaseId: input.caseId,
      expectedSeriesId: input.seriesId,
      expectedProposalDigest: input.proposal.props.digest.toString(),
      expectedPayload: JSON.parse(input.proposal.props.canonical.toString()),
      completionOperationKey: "system.record.preserve",
      subjectEmployeeId: null,
      targetDepartmentCode: null,
      excludedEmployeeIds: new Set(),
      executorAccountId: input.executorAccountId,
      executedAt: input.executedAt,
    })
  }
}
