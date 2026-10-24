import { PersonnelActionCompletionPreparationAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action-completion-preparation.adapter"
import { FindPersonnelActionRequestAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/find-personnel-action-request.adapter"
import { ResolveActiveSystemAccountIdAdapter } from "@/contexts/company/infrastructure/adapters/account-profile/resolve-active-system-account-id.adapter"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { PersonnelActionPersistenceAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action-persistence.adapter"
import { RevalidatePersonnelActionExecutionAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/revalidate-personnel-action-execution.adapter"
import {
  CompanyOperationError,
  CompanyConflictError,
  CompanyNotFoundError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { systemCaseIdSchema } from "@system/domain/schemas/workflow/system-case.schema"
type Context = CompanyContext

/** 承認済みの人事変更申請を実行する。 */
export class CompleteApprovedPersonnelActionRequest {
  private static readonly operationKey = "company.personnel-action.apply"

  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(
    command: Readonly<{
      applicationId: number
      session: CompanyPersonnelSession
      completedAt: Date
    }>,
  ): Promise<Readonly<{ actionId: string }> | CompanyOperationError> {
    const request = await new FindPersonnelActionRequestAdapter(this.c).findPersonnelActionRequest(
      command.session,
      {
        applicationId: command.applicationId,
      },
    )
    if (request instanceof CompanyOperationError) return request
    if (request === null) {
      return new CompanyNotFoundError(
        "人事変更申請が見つかりません",
        "personnel_action_request_not_found",
      )
    }
    if (request.status !== "approved" || request.withdrawnAt !== null) {
      return new CompanyConflictError("人事変更申請は実行できません", "already_decided")
    }
    if (request.appliedActionId !== null) return { actionId: request.appliedActionId }

    const executionGuards = await new RevalidatePersonnelActionExecutionAdapter(this.c).prepare({
      request,
      session: command.session,
      executedAt: command.completedAt,
    })
    if (executionGuards instanceof CompanyOperationError) return executionGuards

    const prepared = await new PersonnelActionCompletionPreparationAdapter(this.c).prepare({
      session: command.session,
      employeeId: request.targetEmployeeId,
      input: request.action,
      sourceApplicationId: request.applicationId,
      requestedByEmployeeId: request.requestedByEmployeeId,
      expectedEmployeeRevision: request.baseEmployeeRevision,
      expectedOrganizationRevision: request.baseOrganizationRevision,
      expectedCompanyRevision: request.baseCompanyRevision ?? undefined,
      expectedPayloadFingerprint: request.payloadFingerprint,
    })
    if (prepared instanceof CompanyOperationError) return prepared
    const accountId = await new ResolveActiveSystemAccountIdAdapter(
      this.c,
    ).resolveActiveSystemAccountId(command.session.accountId)
    if (accountId instanceof Error) {
      return new CompanyUnexpectedError("実行者のSystemアカウントを解決できません", {
        cause: accountId,
      })
    }
    const caseId = systemCaseIdSchema.safeParse(request.systemCaseId)
    const digest = proposalDigestSchema.safeParse(request.proposalDigest)
    if (!caseId.success || !digest.success) {
      return new CompanyUnexpectedError("人事変更申請のSystem証跡が不正です")
    }
    const authorization = ExecutionAuthorizationEntity.create({
      id: crypto.randomUUID(),
      caseId: caseId.data,
      operationKey: CompleteApprovedPersonnelActionRequest.operationKey,
      proposalDigest: digest.data,
      grantedToAccountId: accountId,
      grantedAt: command.completedAt,
      expiresAt: new Date(command.completedAt.getTime() + 5 * 60 * 1_000),
      usedAt: null,
    })
    if (authorization instanceof Error) {
      return new CompanyUnexpectedError("System実行許可を作成できません", { cause: authorization })
    }
    const executed = await new PersonnelActionPersistenceAdapter(this.c).executeAuthorized({
      authorization,
      proposalDigest: digest.data,
      executedAt: command.completedAt,
      executionGuards,
      persistence: prepared.persistence,
      request: { id: request.id, applicationId: request.applicationId },
    })
    if (executed instanceof Error) {
      const replay = await new FindPersonnelActionRequestAdapter(this.c).findPersonnelActionRequest(
        command.session,
        {
          applicationId: command.applicationId,
        },
      )
      if (
        !(replay instanceof CompanyOperationError) &&
        replay !== null &&
        replay.appliedActionId !== null
      ) {
        return { actionId: replay.appliedActionId }
      }
      if (executed instanceof CompanyOperationError) return executed
      return new CompanyUnexpectedError("承認済み人事変更を実行できません", { cause: executed })
    }

    return { actionId: prepared.action.id }
  }
}
