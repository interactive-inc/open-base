import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { PersonnelActionRequestRecord } from "@/contexts/company/domain/definitions/personnel-action-request-record.definition"
import type { CompanyOperationError } from "@/contexts/company/domain/errors"
import { RevalidateCompanyProcedureExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-execution.adapter"

type Context = CompanyContext
type Input = Readonly<{
  request: PersonnelActionRequestRecord
  session: CompanyPersonnelSession
  executedAt: Date
}>

/** 発令の対象者・申請者と承認された内容を、実行時の会社資格へ結び付ける。 */
export class RevalidatePersonnelActionExecutionAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Input): Promise<ReadonlyArray<D1PreparedStatement> | CompanyOperationError> {
    return new RevalidateCompanyProcedureExecutionAdapter(this.c).prepare({
      applicationId: input.request.applicationId,
      expectedCaseId: input.request.systemCaseId,
      expectedSeriesId: input.request.systemProposalSeriesId,
      expectedProposalDigest: input.request.proposalDigest,
      expectedPayload: input.request.action,
      completionOperationKey: "company.personnel-action.apply",
      subjectEmployeeId: input.request.targetEmployeeId,
      targetDepartmentCode: input.request.targetDepartmentCode,
      excludedEmployeeIds: new Set(
        input.request.targetEmployeeId === null
          ? [input.request.requestedByEmployeeId]
          : [input.request.requestedByEmployeeId, input.request.targetEmployeeId],
      ),
      executorAccountId: input.session.accountId,
      executorEmployeeId: input.session.employeeId,
      executedAt: input.executedAt,
    })
  }
}
