import { resolveCompanyProcedureTask } from "@/contexts/company/interface/operations/resolve-company-procedure-task"
import { findCompanyPersonnelActionRequest } from "@/contexts/company/interface/operations/find-company-personnel-action-request"
import { revalidateCompanyProcedureAuthority } from "@/contexts/company/interface/operations/revalidate-company-procedure-authority"
import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { prepareCompanyAuthoritySnapshotGuard } from "@/contexts/company/interface/operations/prepare-company-authority-snapshot-guard"
import { prepareSystemReadAuthorization } from "@system/interface/operations/prepare-system-read-authorization"
import { prepareSystemCaseReadGuard } from "@system/interface/operations/prepare-system-case-read-guard"
import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanyEmployeeDirectoryEntry } from "@/contexts/company/domain/definitions/employee-directory-entry.definition"
import { resolveActiveSystemAccountId } from "@/api/http/accounts/resolve-active-system-account-id"
import { resolveActiveCompanyAccountParticipant } from "@/api/http/accounts/resolve-active-company-account-participant"
import { resolveCompanyAccountParticipants } from "@/api/http/accounts/resolve-company-account-participants"
import { resolveSystemAccountIdsForEmployees } from "@/api/http/accounts/resolve-system-account-ids-for-employees"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import { type CompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/parse-company-procedure-decision.policy"
import { completeCompanyApprovedPersonnelActionRequest } from "@/contexts/company/interface/operations/complete-company-approved-personnel-action-request"
import {
  CompanyOperationError,
  CompanyForbiddenError,
  CompanyConflictError,
  CompanyNotFoundError,
} from "@/contexts/company/domain/errors"
import type { Context, Variables } from "@/env"
import { canRepairWorkflow } from "@/api/http/application-requests/lib/can-repair-workflow"
import { parseJsonValue } from "@/api/http/application-requests/lib/parse-json-value"
import { isUniqueConstraintError } from "@/lib/d1/is-unique-constraint-error"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  UnprocessableError,
} from "@/lib/errors"
import {
  loadSystemProcedure,
  parseSystemProcedureInputSchema,
  parseSystemProcedurePolicy,
} from "@/api/http/application-templates/lib/system-procedure-route"
import { validateAndNormalizeApplicationPayload } from "@/api/http/application-requests/lib/validate-system-procedure-payload"
import { CancelSystemProcedure } from "@system/application/workflow/cancel-system-procedure"
import {
  createSystemDecisionTask,
  type StartSystemProcedureTask,
} from "@system/domain/policies/decision-task.policy"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"
import { RejectSystemTask } from "@system/application/workflow/reject-system-task"
import { ReturnSystemTask } from "@system/application/workflow/return-system-task"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import type { SystemProposalView } from "@system/domain/definitions/workflow/system-proposal-view.definition"
import { systemCaseIdSchema } from "@system/domain/schemas/workflow/system-case.schema"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { openSystemWorkflow } from "@system/interface/operations/open-system-workflow"
import { SystemDecisionTargetValue } from "@system/domain/values/workflow/system-decision-target.value"
import { AttachmentErasureError } from "@system/application/attachments/errors"
import { ATTACHMENT_ERASURE_OPERATION_KEY } from "@system/domain/values/attachments/attachment-erasure-request.value"
import { executeSystemAttachmentErasure } from "@system/interface/operations/execute-system-attachment-erasure"
import { prepareSystemAttachmentErasureDecisionAudit } from "@system/interface/operations/prepare-system-attachment-erasure-decision-audit"
import { prepareSystemAttachmentErasureRequest } from "@system/interface/operations/prepare-system-attachment-erasure-request"

export type SystemApplicationResult = Readonly<{
  proposal: SystemProposalView
  applicantName: string
  approverRoles: ReadonlyArray<string>
}>

export function systemProposalQuery(c: Context) {
  return openSystemProposals({
    env: { DB: c.env.DB },
    visibleCompletionOperationKeys: [
      null,
      "company.personnel-action.apply",
      "system.record.preserve",
      ATTACHMENT_ERASURE_OPERATION_KEY,
    ],
  })
}

export async function submitSystemApplication(
  c: Context,
  input: Readonly<{
    applicantId: EmployeeId
    templateCode: string
    payload: unknown
    createdAt: Date
  }>,
): Promise<SystemApplicationResult | ApplicationError> {
  const definition = await loadSystemProcedure(c, input.templateCode)
  if (definition instanceof Error) {
    return new UnexpectedError("failed to find application template", { cause: definition })
  }
  if (definition === null) return new NotFoundError("template not found", "template_not_found")
  if (definition.completionOperationKey !== null) {
    return new UnprocessableError(
      "system template requires its dedicated request route",
      "system_template_requires_dedicated_route",
    )
  }
  const schema = parseSystemProcedureInputSchema(definition)
  const policy = parseSystemProcedurePolicy(definition)
  if (schema instanceof Error || policy instanceof Error) {
    return new UnexpectedError("invalid application template")
  }

  return startSystemApplication(c, {
    applicantId: input.applicantId,
    schema: schema.value,
    policy,
    procedureKey: definition.key,
    procedureRevision: definition.revision,
    payload: input.payload,
    createdAt: input.createdAt,
    seriesId: crypto.randomUUID(),
    version: 1,
    supersedesProposalId: null,
  })
}

export async function reviseSystemApplication(
  c: Context,
  input: Readonly<{
    number: number
    applicantId: EmployeeId
    payload: unknown
    revisedAt: Date
    mode: "edit" | "resubmit"
  }>,
): Promise<SystemApplicationResult | ApplicationError> {
  const current = await systemProposalQuery(c).findByNumber(input.number)
  if (current instanceof Error) {
    return new UnexpectedError("failed to find application", { cause: current })
  }
  if (current === null) return new NotFoundError("application not found", "application_not_found")
  const participant = await resolveActiveCompanyAccountParticipant(c, current.createdByAccountId)
  if (participant instanceof Error) {
    return new UnexpectedError("failed to resolve application owner", { cause: participant })
  }
  if (participant === null || participant.employeeId !== input.applicantId) {
    return new ForbiddenError("not the applicant", "not_applicant")
  }
  const policy = parseJsonPolicy(current.decisionPolicyJson)
  const schema = parseJsonValue(current.inputSchemaJson)
  if (policy instanceof Error || schema instanceof Error) {
    return new UnexpectedError("invalid application procedure")
  }
  if (current.completionOperationKey !== null) {
    return new ConflictError(
      "system application must use its dedicated route",
      "system_template_requires_dedicated_route",
    )
  }
  if (input.mode === "edit") {
    if (current.status !== "pending") {
      return new ConflictError("application is already decided", "not_pending")
    }
    if (policy.workflow !== null) {
      return new ConflictError(
        "workflow application can only be edited when resubmitting a return",
        "workflow_locked",
      )
    }
  } else if (current.status !== "returned" || policy.workflow === null) {
    return new ConflictError("application is not returned", "not_returned")
  }

  return startSystemApplication(c, {
    applicantId: input.applicantId,
    schema: schema.value,
    policy,
    procedureKey: current.procedureKey,
    procedureRevision: current.procedureRevision,
    payload: input.payload,
    createdAt: input.revisedAt,
    seriesId: current.seriesId,
    version: current.version + 1,
    supersedesProposalId: current.proposalId,
  })
}

export async function withdrawSystemApplication(
  c: Context,
  input: Readonly<{ number: number; applicantId: EmployeeId; withdrawnAt: Date }>,
): Promise<true | ApplicationError> {
  const current = await systemProposalQuery(c).findByNumber(input.number)
  if (current instanceof Error) {
    return new UnexpectedError("failed to find application", { cause: current })
  }
  if (current === null) return new NotFoundError("application not found", "application_not_found")
  const participant = await resolveActiveCompanyAccountParticipant(c, current.createdByAccountId)
  if (participant instanceof Error) {
    return new UnexpectedError("failed to resolve application owner", { cause: participant })
  }
  if (participant === null || participant.employeeId !== input.applicantId) {
    return new ForbiddenError("not the applicant", "not_applicant")
  }
  if (current.completionOperationKey !== null) {
    return new ConflictError(
      "system application must use its dedicated withdrawal route",
      "system_template_requires_dedicated_route",
    )
  }
  const result = await new CancelSystemProcedure(openSystemWorkflow({ env: { DB: c.env.DB } })).run(
    {
      number: input.number,
      createdByAccountId: current.createdByAccountId,
      cancelledAt: input.withdrawnAt,
    },
  )
  if (result === "not_found") {
    return new NotFoundError("application not found", "application_not_found")
  }
  if (result === "not_pending") {
    return new ConflictError("application is already decided", "not_pending")
  }
  return result instanceof Error
    ? new UnexpectedError("failed to withdraw application", { cause: result })
    : true
}

export async function decideSystemApplication(
  c: Context & { readonly var: Pick<Variables, "bearerReadAuthentication"> },
  input: Readonly<{
    number: number
    actorEmployeeId: EmployeeId
    action: "approve" | "reject"
    decisionTarget: Readonly<{
      proposalVersion: number
      proposalDigest: string
      taskKey: string
      taskRound: number
    }>
    comment: string | null
    decidedAt: Date
  }>,
): Promise<Readonly<{ status: "pending" | "approved" | "rejected" }> | ApplicationError> {
  const query = systemProposalQuery(c)
  const proposal = await query.findByNumber(input.number)
  if (proposal instanceof Error) {
    return new UnexpectedError("failed to find application", { cause: proposal })
  }
  if (proposal === null || proposal.status === "cancelled") {
    return new NotFoundError("application not found", "application_not_found")
  }
  const expected = SystemDecisionTargetValue.create(input.decisionTarget)
  const current = SystemDecisionTargetValue.create({
    proposalVersion: proposal.version,
    proposalDigest: proposal.digest,
    taskKey: proposal.currentTaskKey ?? proposal.lastTaskKey,
    taskRound: proposal.currentTaskRound ?? proposal.lastTaskRound,
  })
  if (
    expected instanceof Error ||
    proposal.version !== input.decisionTarget.proposalVersion ||
    proposal.digest !== input.decisionTarget.proposalDigest
  ) {
    return new ConflictError("application decision target changed", "decision_target_changed")
  }
  if (
    proposal.completionOperationKey === "system.record.preserve" &&
    input.action === "approve" &&
    (proposal.status === "pending" ||
      proposal.status === "approved" ||
      proposal.status === "executed")
  ) {
    const session = c.var.session
    const authentication = c.var.bearerReadAuthentication
    if (
      session === null ||
      session.employeeId !== input.actorEmployeeId ||
      authentication === undefined ||
      authentication.accountId !== session.accountId ||
      authentication.machineCredentialId !== null
    )
      return new ForbiddenError("cannot replay another employee's decision", "forbidden")
    const attestations = await query.listAttestations(proposal.caseId)
    if (attestations instanceof Error)
      return new UnexpectedError("failed to verify original decision", { cause: attestations })
    const original = attestations.find(
      (attestation) =>
        attestation.actorAccountId === session.accountId &&
        attestation.taskKey === input.decisionTarget.taskKey &&
        attestation.round === input.decisionTarget.taskRound &&
        attestation.action === "approve" &&
        attestation.comment === input.comment,
    )
    if (original !== undefined) {
      const proof = await prepareSystemReadAuthorization({
        database: c.env.DB,
        authentication: authentication,
        at: input.decidedAt,
      })
      if (proof instanceof Error)
        return new UnexpectedError("failed to verify replay authorization", { cause: proof })
      if (proof === null) return new ForbiddenError("replay authorization changed", "forbidden")
      const guard = await prepareSystemCaseReadGuard(c, {
        caseId: proposal.caseId,
        accountId: session.accountId,
        at: input.decidedAt,
      })
      if (guard instanceof Error)
        return new UnexpectedError("failed to prepare replay guard", { cause: guard })
      const latest = await query.findByNumber(input.number)
      if (latest instanceof Error)
        return new UnexpectedError("failed to verify replay target", { cause: latest })
      if (
        latest === null ||
        latest.proposalId !== proposal.proposalId ||
        latest.status !== proposal.status ||
        latest.currentTaskKey !== proposal.currentTaskKey ||
        latest.currentTaskRound !== proposal.currentTaskRound
      )
        return new ConflictError("application decision target changed", "decision_target_changed")
      const now = new Date(c.env.NOW ?? Date.now())
      const assertions = proof.assertions(now)
      if (assertions instanceof Error)
        return new ForbiddenError("replay authorization changed", "forbidden")
      try {
        const verified = await c.env.DB.batch([...assertions, guard(now)])
        if (verified.length !== assertions.length + 1 || verified.some((result) => !result.success))
          return new ConflictError("application decision target changed", "decision_target_changed")
      } catch (cause) {
        return new ConflictError("application decision target changed", "decision_target_changed", {
          cause,
        })
      }
      return { status: proposal.status === "pending" ? "pending" : "approved" }
    }
    if (proposal.status !== "pending")
      return new ForbiddenError("original approval does not belong to this actor", "forbidden")
  }
  if (current instanceof Error || !expected.equals(current)) {
    return new ConflictError("application decision target changed", "decision_target_changed")
  }
  if (
    input.action === "approve" &&
    (proposal.status === "approved" || proposal.status === "executed")
  ) {
    const completed = await completeSystemApplicationIfRequired(c, proposal, input.decidedAt)
    return completed instanceof ApplicationError ? completed : { status: "approved" }
  }
  if (
    proposal.status !== "pending" ||
    proposal.currentTaskKey === null ||
    proposal.currentTaskRound === null
  ) {
    return new ConflictError("application is already decided", "already_decided")
  }
  const policy = parseJsonPolicy(proposal.decisionPolicyJson)
  const payload = parseJsonValue(proposal.bodyJson)
  if (policy instanceof Error || payload instanceof Error) {
    return new UnexpectedError("invalid application procedure")
  }
  const step = policy.workflow?.steps.find((candidate) => candidate.key === proposal.currentTaskKey)
  if (step === undefined) {
    return new ForbiddenError("decision authority is undefined", "forbidden")
  }
  const tasks = await query.listTasks(proposal.caseId)
  if (tasks instanceof Error)
    return new UnexpectedError("failed to load frozen decision rules", { cause: tasks })
  const decisionTask = tasks.find(
    (task) => task.key === proposal.currentTaskKey && task.round === proposal.currentTaskRound,
  )
  if (decisionTask === undefined)
    return new ConflictError("current decision task is missing", "already_decided")
  const session = c.var.session
  if (session === null || session.employeeId !== input.actorEmployeeId) {
    return new ForbiddenError("cannot decide as another employee", "forbidden")
  }
  const actorAccountId = await resolveActiveSystemAccountId(c, session.accountId)
  if (actorAccountId instanceof Error) {
    return new UnexpectedError("failed to resolve canonical workflow actor", {
      cause: actorAccountId,
    })
  }
  const candidateAccountIds = await query.listTaskCandidateAccountIds({
    caseId: proposal.caseId,
    taskKey: proposal.currentTaskKey,
    round: proposal.currentTaskRound,
    at: input.decidedAt,
  })
  if (candidateAccountIds instanceof Error) {
    return new UnexpectedError("failed to load decision candidates", {
      cause: candidateAccountIds,
    })
  }
  const authorityGuard = await prepareCompanyAuthoritySnapshotGuard(
    {
      database: c.env.DB,
    },
    {
      accountIds: [...candidateAccountIds, proposal.createdByAccountId, actorAccountId],
      employeeCodes: (policy.workflow?.steps ?? []).flatMap((workflowStep) =>
        [...workflowStep.approvers, ...workflowStep.escalation_approvers].flatMap((selector) =>
          selector.type === "employee" ? [selector.employee_code] : [],
        ),
      ),
    },
  )
  if (authorityGuard instanceof Error) {
    return new UnexpectedError("failed to capture Company decision authority", {
      cause: authorityGuard,
    })
  }
  const actor = await resolveActiveCompanyAccountParticipant(c, actorAccountId)
  if (actor instanceof Error) {
    return new UnexpectedError("failed to resolve Company workflow actor", { cause: actor })
  }
  if (actor === null || actor.employeeId !== input.actorEmployeeId) {
    return new ForbiddenError("workflow actor is not active", "forbidden")
  }
  let representedAccountId = actorAccountId
  let delegationId: string | null = null
  if (!candidateAccountIds.includes(actorAccountId)) {
    if (step.allow_delegation === false || decisionTask.delegationPolicy === "forbidden") {
      return new ForbiddenError("workflow step does not allow delegation", "forbidden")
    }
    const delegation = await query.findDelegation({
      caseId: proposal.caseId,
      actorAccountId,
      candidateAccountIds,
      at: input.decidedAt,
    })
    if (delegation instanceof Error) {
      return new UnexpectedError("failed to resolve delegation", { cause: delegation })
    }
    if (delegation === null) {
      return new ForbiddenError("not eligible to decide application", "forbidden")
    }
    representedAccountId = delegation.representedAccountId
    delegationId = delegation.id
  }
  const represented = await resolveActiveCompanyAccountParticipant(c, representedAccountId)
  if (represented instanceof Error) {
    return new UnexpectedError("failed to revalidate Company decision authority", {
      cause: represented,
    })
  }
  if (represented === null) {
    return new ForbiddenError("decision authority is no longer active", "forbidden")
  }
  const applicantParticipant = await resolveActiveCompanyAccountParticipant(
    c,
    proposal.createdByAccountId,
  )
  if (applicantParticipant instanceof Error || applicantParticipant === null) {
    return new UnexpectedError("failed to resolve workflow applicant", {
      cause: applicantParticipant instanceof Error ? applicantParticipant : undefined,
    })
  }
  const applicant = await openCompanyEmployeeDirectory(c).findById(applicantParticipant.employeeId)
  if (applicant instanceof Error || applicant === null) {
    return new UnexpectedError("failed to load workflow applicant", {
      cause: applicant instanceof Error ? applicant : undefined,
    })
  }
  let authoritySubjectEmployeeId: EmployeeId | null | undefined
  let targetDepartmentCode: string | null | undefined
  let excludedEmployeeIds: ReadonlySet<EmployeeId> | undefined
  if (proposal.completionOperationKey === "system.record.preserve") {
    const intent = await RecordPreservationProposalValue.restore(payload.value)
    if (intent instanceof Error)
      return new UnexpectedError("invalid record preservation proposal", { cause: intent })
    authoritySubjectEmployeeId = null
    targetDepartmentCode = null
  }
  if (proposal.completionOperationKey === ATTACHMENT_ERASURE_OPERATION_KEY) {
    authoritySubjectEmployeeId = null
    targetDepartmentCode = null
  }
  if (proposal.completionOperationKey === "company.personnel-action.apply") {
    const personnelRequest = await findCompanyPersonnelActionRequest(c, session, {
      applicationId: proposal.number,
    })
    if (personnelRequest instanceof CompanyConflictError)
      return new ConflictError(personnelRequest.message, personnelRequest.code)
    if (personnelRequest instanceof Error)
      return new UnexpectedError("failed to load personnel request", { cause: personnelRequest })
    if (personnelRequest === null) {
      return new UnexpectedError("Company personnel action association is missing")
    }
    authoritySubjectEmployeeId = personnelRequest.targetEmployeeId
    targetDepartmentCode = personnelRequest.targetDepartmentCode
    excludedEmployeeIds = new Set(
      personnelRequest.targetEmployeeId === null
        ? [personnelRequest.requestedByEmployeeId]
        : [personnelRequest.requestedByEmployeeId, personnelRequest.targetEmployeeId],
    )
  }
  const hasCurrentAuthority = await revalidateCompanyProcedureAuthority(c, {
    step,
    payload: payload.value,
    task: decisionTask,
    representedAccountId,
    subjectEmployeeId:
      authoritySubjectEmployeeId === undefined
        ? applicantParticipant.employeeId
        : authoritySubjectEmployeeId,
    targetDepartmentCode: targetDepartmentCode ?? null,
    excludedEmployeeIds: excludedEmployeeIds ?? new Set(),
    dueAt: proposal.currentTaskDueAt,
    decidedAt: input.decidedAt,
  })
  if (hasCurrentAuthority instanceof Error) {
    return new ForbiddenError("decision authority cannot be revalidated", "forbidden", {
      cause: hasCurrentAuthority,
    })
  }
  if (!hasCurrentAuthority) {
    return new ForbiddenError("decision authority no longer applies", "forbidden")
  }
  const systemAction =
    input.action === "reject" && step?.rejection_behavior === "return" ? "return" : input.action
  if (systemAction === "return" && decisionTask.returnPolicy === "forbidden") {
    return new ForbiddenError("this decision cannot be returned", "forbidden")
  }
  let nextTaskGuards: ReadonlyArray<D1PreparedStatement> = []
  let nextTask = null
  if (systemAction === "approve") {
    const next = await resolveCompanyProcedureTask({
      c,
      policy,
      payload: payload.value,
      applicant: toProcedureApplicant(applicant),
      activatedAt: input.decidedAt,
      afterTaskKey: proposal.currentTaskKey,
      authoritySubjectEmployeeId,
      targetDepartmentCode,
      excludedEmployeeIds,
    })
    if (next instanceof Error) {
      return new UnprocessableError(
        "next workflow step cannot be resolved",
        "workflow_unresolvable",
        { cause: next },
      )
    }
    if (next !== null) {
      nextTaskGuards = next.guards
      const caseId = systemCaseIdSchema.safeParse(proposal.caseId)
      if (!caseId.success) return new UnexpectedError("invalid System Case ID")
      const persistence = createSystemDecisionTask({
        task: next.task,
        caseId: caseId.data,
        createdByAccountId: proposal.createdByAccountId,
        proposalDigest: proposal.digest,
      })
      if (persistence instanceof Error) {
        return new UnexpectedError("invalid next System Task", { cause: persistence })
      }
      nextTask = persistence
    }
  }
  const caseId = systemCaseIdSchema.safeParse(proposal.caseId)
  if (!caseId.success) return new UnexpectedError("invalid System Case ID")
  let decisionEffects: ReadonlyArray<D1PreparedStatement> = []
  if (proposal.completionOperationKey === ATTACHMENT_ERASURE_OPERATION_KEY) {
    const audit = prepareSystemAttachmentErasureDecisionAudit(
      { env: { DB: c.env.DB } },
      {
        proposal,
        actorAccountId,
        representedAccountId,
        action: systemAction,
        taskKey: proposal.currentTaskKey,
        round: proposal.currentTaskRound,
        decidedAt: input.decidedAt,
      },
    )
    if (audit instanceof Error)
      return new UnexpectedError("failed to prepare erasure decision audit", { cause: audit })
    decisionEffects = audit
  }
  const workflow = openSystemWorkflow({
    env: { DB: c.env.DB },
    decisionGuards: [authorityGuard, ...nextTaskGuards],
    decisionEffects,
  })
  const command = {
    caseId: caseId.data,
    taskKey: proposal.currentTaskKey,
    round: proposal.currentTaskRound,
    actorAccountId,
    representedAccountId,
    delegationId,
    proposalDigest: proposal.digest,
    comment: input.comment,
    decidedAt: input.decidedAt,
    nextTask,
  }
  let result
  if (systemAction === "approve") {
    result = await new ApproveSystemTask(workflow).execute(command)
  } else if (systemAction === "reject") {
    result = await new RejectSystemTask(workflow).execute(command)
  } else {
    result = await new ReturnSystemTask(workflow).execute(command)
  }
  if (result instanceof Error) {
    if (isAbortedByGuard(result)) {
      return new ConflictError("decision authority changed during approval", "authority_changed")
    }
    if (
      isUniqueConstraintError(result) ||
      // System の SQL trigger メッセージ依存。System 側で判別子化するまでの暫定。
      result.message.includes("invalid human attestation")
    ) {
      return new ConflictError("application is already decided", "already_decided")
    }
    return new UnexpectedError("failed to decide System application", { cause: result })
  }

  if (result.caseStatus === "approved") {
    const completed = await completeSystemApplicationIfRequired(c, proposal, input.decidedAt)
    if (completed instanceof ApplicationError) return completed
    return { status: "approved" }
  }

  return { status: result.caseStatus === "rejected" ? "rejected" : "pending" }
}

async function completeSystemApplicationIfRequired(
  c: Context & { readonly var: Pick<Variables, "bearerReadAuthentication"> },
  proposal: SystemProposalView,
  completedAt: Date,
): Promise<true | ApplicationError> {
  if (proposal.completionOperationKey === null) return true
  if (proposal.completionOperationKey === ATTACHMENT_ERASURE_OPERATION_KEY) {
    // 最終承認者が消去権限を持たない場合は承認済みのまま残し、専用の実行操作で確定する。
    const executed = await executeSystemApplicationErasure(c, proposal.number, completedAt)
    return executed instanceof ForbiddenError
      ? true
      : executed instanceof ApplicationError
        ? executed
        : true
  }
  // 保全実行には原記録の再検査が必要なため、承認後は専用の実行操作へ進む。
  if (proposal.completionOperationKey === "system.record.preserve") return true
  if (proposal.completionOperationKey !== "company.personnel-action.apply") {
    return new UnexpectedError("unknown System completion operation")
  }
  const session = c.var.session
  if (session === null) return new UnexpectedError("authenticated session is missing")
  const completed = await completeCompanyApprovedPersonnelActionRequest(c, {
    applicationId: proposal.number,
    session,
    completedAt,
  })
  if (completed instanceof CompanyForbiddenError)
    return new ForbiddenError(completed.message, completed.code, { cause: completed })
  if (completed instanceof CompanyConflictError)
    return new ConflictError(completed.message, completed.code, { cause: completed })
  if (completed instanceof CompanyNotFoundError)
    return new NotFoundError(completed.message, completed.code, { cause: completed })
  if (completed instanceof CompanyOperationError)
    return new UnexpectedError(completed.message, { cause: completed })
  return true
}

export async function reassignSystemApplicationTask(
  c: Context,
  input: Readonly<{
    number: number
    candidateEmployeeIds: ReadonlyArray<EmployeeId>
    requiredApprovals: number | undefined
    reason: string
    reassignedAt: Date
  }>,
): Promise<
  | Readonly<{
      status: "pending"
      stepKey: string
      round: number
      candidateEmployeeIds: ReadonlyArray<EmployeeId>
    }>
  | ApplicationError
> {
  const session = c.var.session
  if (session === null || !canRepairWorkflow(session)) {
    return new ForbiddenError("cannot repair application workflows", "forbidden")
  }
  const query = systemProposalQuery(c)
  const proposal = await query.findByNumber(input.number)
  if (proposal instanceof Error) {
    return new UnexpectedError("failed to load application", { cause: proposal })
  }
  if (proposal === null || proposal.status === "cancelled") {
    return new NotFoundError("application not found", "application_not_found")
  }
  if (
    proposal.status !== "pending" ||
    proposal.currentTaskKey === null ||
    proposal.currentTaskRound === null
  ) {
    return new ConflictError("workflow is not pending", "already_decided")
  }
  const policy = parseJsonPolicy(proposal.decisionPolicyJson)
  if (policy instanceof Error || policy.workflow === null) {
    return new NotFoundError("workflow instance not found", "workflow_not_found")
  }
  const applicant = await resolveActiveCompanyAccountParticipant(c, proposal.createdByAccountId)
  if (applicant instanceof Error || applicant === null) {
    return new UnexpectedError("failed to resolve application owner", {
      cause: applicant instanceof Error ? applicant : undefined,
    })
  }
  const candidateEmployeeIds = [...new Set(input.candidateEmployeeIds)]
  if (
    candidateEmployeeIds.length === 0 ||
    candidateEmployeeIds.includes(applicant.employeeId) ||
    candidateEmployeeIds.includes(session.employeeId)
  ) {
    return new UnprocessableError("applicant cannot be the repair approver", "invalid_candidate")
  }
  const tasks = await query.listTasks(proposal.caseId)
  if (tasks instanceof Error) {
    return new UnexpectedError("failed to load workflow task", { cause: tasks })
  }
  const currentTask = tasks.find(
    (task) => task.key === proposal.currentTaskKey && task.round === proposal.currentTaskRound,
  )
  if (currentTask === undefined) return new UnexpectedError("current System Task is missing")
  const requiredApprovals = input.requiredApprovals ?? currentTask.requiredApprovals
  if (requiredApprovals !== currentTask.requiredApprovals) {
    return new UnprocessableError(
      "required approvals must preserve the frozen quorum",
      "workflow_quorum_mismatch",
    )
  }
  if (
    candidateEmployeeIds.length < requiredApprovals ||
    candidateEmployeeIds.length < currentTask.requiredParticipants
  ) {
    return new UnprocessableError(
      "repair candidates cannot satisfy the frozen quorum",
      "workflow_unresolvable",
    )
  }
  const accountIds = await resolveSystemAccountIdsForEmployees(c, candidateEmployeeIds)
  if (accountIds instanceof Error) {
    return new UnexpectedError("failed to resolve repair candidate accounts", {
      cause: accountIds,
    })
  }
  const participants = await resolveCompanyAccountParticipants(c, accountIds)
  if (participants instanceof Error) {
    return new UnexpectedError("failed to resolve repair candidates", { cause: participants })
  }
  const liveParticipants = participants.filter(
    (participant) => participant.status === "ACTIVE" || participant.status === "ON_LEAVE",
  )
  const resolvedEmployeeIds = new Set(liveParticipants.map((participant) => participant.employeeId))
  if (candidateEmployeeIds.some((employeeId) => !resolvedEmployeeIds.has(employeeId))) {
    return new UnprocessableError(
      "a repair candidate has no active account",
      "workflow_unresolvable",
    )
  }
  const actorAccountId = await resolveActiveSystemAccountId(c, session.accountId)
  if (actorAccountId instanceof Error) {
    return new UnexpectedError("failed to resolve canonical workflow actor", {
      cause: actorAccountId,
    })
  }
  const resolutionId = crypto.randomUUID()
  const candidates: StartSystemProcedureTask["candidates"][number][] = []
  for (const participant of liveParticipants) {
    const evidence = CanonicalSystemJsonValue.create({
      actorAccountId,
      candidateAccountId: participant.accountId,
      candidateEmployeeId: participant.employeeId,
      reason: input.reason,
      reassignedAt: input.reassignedAt.toISOString(),
    })
    if (evidence instanceof Error) {
      return new UnexpectedError("failed to canonicalize repair evidence", { cause: evidence })
    }
    const digest = await ProposalDigestValue.create(evidence)
    if (digest instanceof Error) {
      return new UnexpectedError("failed to digest repair evidence", { cause: digest })
    }
    candidates.push({
      accountId: participant.accountId,
      source: "primary",
      evidenceContext: "company",
      evidenceKind: "manual-workflow-repair",
      evidenceId: resolutionId,
      evidenceVersion: input.reassignedAt.toISOString(),
      eligibilityDigest: digest.toString(),
      eligibleFrom: null,
      resolvedAt: input.reassignedAt,
    })
  }
  const caseId = systemCaseIdSchema.safeParse(proposal.caseId)
  if (!caseId.success) return new UnexpectedError("invalid System Case ID")
  const round = proposal.currentTaskRound + 1
  const replacement = createSystemDecisionTask({
    task: {
      key: proposal.currentTaskKey,
      requiredApprovals,
      requiredParticipants: currentTask.requiredParticipants,
      negativeDecisionRule: currentTask.negativeDecisionRule,
      delegationPolicy: currentTask.delegationPolicy,
      returnPolicy: currentTask.returnPolicy,
      openedAt: input.reassignedAt,
      dueAt: null,
      candidates,
      excludedAccountIds: [actorAccountId],
    },
    caseId: caseId.data,
    createdByAccountId: proposal.createdByAccountId,
    proposalDigest: proposal.digest,
    round,
  })
  if (replacement instanceof Error) {
    return new UnprocessableError("invalid workflow repair", "invalid_candidate", {
      cause: replacement,
    })
  }
  const result = await openSystemWorkflow({ env: { DB: c.env.DB } }).reassign({
    caseId: proposal.caseId,
    taskKey: proposal.currentTaskKey,
    round: proposal.currentTaskRound,
    reassignedAt: input.reassignedAt,
    replacement,
  })
  if (result === "not_pending") {
    return new ConflictError("workflow is not repairable", "workflow_not_repairable")
  }
  if (result instanceof Error) {
    return new UnexpectedError("failed to reassign workflow", { cause: result })
  }

  return { status: "pending", stepKey: proposal.currentTaskKey, round, candidateEmployeeIds }
}

async function startSystemApplication(
  c: Context,
  input: Readonly<{
    applicantId: EmployeeId
    schema: unknown
    policy: CompanyProcedureDecisionPolicy
    procedureKey: string
    procedureRevision: number
    payload: unknown
    createdAt: Date
    seriesId: string
    version: number
    supersedesProposalId: string | null
    /** System operationが検査・固定した本文。templateの入力schemaでは検査しない。 */
    systemBody?: true
    startGuards?: ReadonlyArray<D1PreparedStatement>
  }>,
): Promise<SystemApplicationResult | ApplicationError> {
  const payload =
    input.systemBody === true
      ? input.payload
      : validateAndNormalizeApplicationPayload(input.schema, input.payload)
  if (payload instanceof Error) {
    return new UnprocessableError("payload does not match template schema", "invalid_payload", {
      cause: payload,
    })
  }
  const applicant = await openCompanyEmployeeDirectory(c).findById(input.applicantId)
  if (applicant instanceof Error) {
    return new UnexpectedError("failed to find applicant", { cause: applicant })
  }
  if (applicant === null) return new UnexpectedError("applicant not found")
  const session = c.var.session
  if (session === null) return new UnexpectedError("authenticated session is missing")
  const accountId = await resolveActiveSystemAccountId(c, session.accountId)
  if (accountId instanceof Error) {
    return new UnexpectedError("failed to resolve canonical applicant", { cause: accountId })
  }
  const participant = await resolveActiveCompanyAccountParticipant(c, accountId)
  if (participant instanceof Error) {
    return new UnexpectedError("failed to resolve Company applicant", { cause: participant })
  }
  if (participant === null || participant.employeeId !== input.applicantId) {
    return new ForbiddenError("cannot submit as another employee", "forbidden")
  }
  const resolvedTask = await resolveCompanyProcedureTask({
    c,
    policy: input.policy,
    payload,
    applicant: toProcedureApplicant(applicant),
    activatedAt: input.createdAt,
    afterTaskKey: null,
  })
  if (resolvedTask instanceof Error || resolvedTask === null) {
    return new UnprocessableError(
      "application workflow has no eligible decision step",
      "workflow_unresolvable",
      { cause: resolvedTask instanceof Error ? resolvedTask : undefined },
    )
  }
  const started = await new StartSystemProcedure({
    writer: openSystemWorkflow({
      env: { DB: c.env.DB },
      startGuards: [...(input.startGuards ?? []), ...resolvedTask.guards],
    }),
  }).run({
    seriesId: input.seriesId,
    version: input.version,
    procedureKey: input.procedureKey,
    procedureRevision: input.procedureRevision,
    body: payload,
    createdByAccountId: accountId,
    supersedesProposalId: input.supersedesProposalId,
    createdAt: input.createdAt,
    firstTask: resolvedTask.task,
  })
  if (started instanceof Error) {
    if (isAbortedByGuard(started))
      return new ConflictError("Company authority changed during submission", "authority_changed")
    return new UnexpectedError("failed to start System procedure", { cause: started })
  }
  const proposal = await systemProposalQuery(c).findByNumber(started.number)
  if (proposal instanceof Error || proposal === null) {
    return new UnexpectedError("failed to read submitted System proposal", {
      cause: proposal instanceof Error ? proposal : undefined,
    })
  }

  return {
    proposal,
    applicantName: applicant.officialName,
    approverRoles: input.policy.approverRoles,
  }
}

function toProcedureApplicant(applicant: CompanyEmployeeDirectoryEntry) {
  return {
    employeeId: applicant.id,
    employeeCode: applicant.employeeCode,
    employmentStatus: applicant.employment?.status ?? null,
    organizationUnitId: applicant.primaryAssignment?.organizationUnitId ?? null,
    organizationUnitCode: applicant.primaryAssignment?.organizationUnitCode ?? null,
    organizationUnitName: applicant.primaryAssignment?.organizationUnitName ?? null,
    positionTitle: applicant.primaryAssignment?.positionTitle ?? null,
  }
}

function parseJsonPolicy(value: string) {
  const parsed = parseJsonValue(value)
  return parsed instanceof Error ? parsed : parseCompanyProcedureDecisionPolicy(parsed.value)
}

function toErasureApplicationError(error: AttachmentErasureError): ApplicationError {
  switch (error.code) {
    case "forbidden":
      return new ForbiddenError("personal data erasure is not permitted", "forbidden", {
        cause: error,
      })
    case "not_found":
      return new NotFoundError("erasure target not found", "erasure_target_not_found", {
        cause: error,
      })
    case "invalid":
      return new UnprocessableError("erasure request is invalid", "erasure_invalid", {
        cause: error,
      })
    case "unavailable":
      return new UnexpectedError("personal data erasure is unavailable", { cause: error })
    default:
      return new ConflictError(`erasure ${error.code.replace("_", " ")}`, `erasure_${error.code}`, {
        cause: error,
      })
  }
}

/** 消去申請テンプレートで、System operationが固定した対象と申請監査を承認手続へ提出する。 */
export async function submitSystemAttachmentErasure(
  c: Context & { readonly var: Pick<Variables, "bearerReadAuthentication"> },
  input: Readonly<{
    applicantId: EmployeeId
    templateCode: string
    requestId: string
    scope: unknown
    reason: string
    createdAt: Date
  }>,
): Promise<SystemApplicationResult | ApplicationError> {
  const definition = await loadSystemProcedure(c, input.templateCode)
  if (definition instanceof Error)
    return new UnexpectedError("failed to find application template", { cause: definition })
  if (definition === null) return new NotFoundError("template not found", "template_not_found")
  if (definition.completionOperationKey !== ATTACHMENT_ERASURE_OPERATION_KEY)
    return new UnprocessableError(
      "template is not a personal data erasure template",
      "erasure_template_required",
    )
  const policy = parseSystemProcedurePolicy(definition)
  if (policy instanceof Error) return new UnexpectedError("invalid application template")
  const authentication = c.var.bearerReadAuthentication
  const session = c.var.session
  if (authentication === undefined || session === null)
    return new ForbiddenError("personal data erasure requires a person", "forbidden")
  const accountId = await resolveActiveSystemAccountId(c, session.accountId)
  if (accountId instanceof Error)
    return new UnexpectedError("failed to resolve canonical applicant", { cause: accountId })
  const query = systemProposalQuery(c)
  const replayed = await query.findBySeriesVersion({
    seriesId: input.requestId,
    version: 1,
    creatorAccountId: accountId,
  })
  if (replayed instanceof Error)
    return new UnexpectedError("failed to find erasure request", { cause: replayed })
  if (replayed !== null) {
    if (replayed.completionOperationKey !== ATTACHMENT_ERASURE_OPERATION_KEY)
      return new ConflictError("request id is already used", "erasure_request_id_conflict")
    const applicant = await openCompanyEmployeeDirectory(c).findById(input.applicantId)
    if (applicant instanceof Error || applicant === null)
      return new UnexpectedError("failed to find applicant", {
        cause: applicant instanceof Error ? applicant : undefined,
      })
    return {
      proposal: replayed,
      applicantName: applicant.officialName,
      approverRoles: policy.approverRoles,
    }
  }
  const prepared = await prepareSystemAttachmentErasureRequest(
    { env: { DB: c.env.DB } },
    {
      authentication,
      requestId: input.requestId,
      scope: input.scope,
      reason: input.reason,
      at: input.createdAt,
    },
  )
  if (prepared instanceof AttachmentErasureError) return toErasureApplicationError(prepared)
  const started = await startSystemApplication(c, {
    applicantId: input.applicantId,
    schema: null,
    policy,
    procedureKey: definition.key,
    procedureRevision: definition.revision,
    payload: prepared.body,
    createdAt: input.createdAt,
    seriesId: prepared.seriesId,
    version: 1,
    supersedesProposalId: null,
    systemBody: true,
    startGuards: prepared.startGuards,
  })
  if (started instanceof ConflictError && started.code === "authority_changed") {
    // 同じ添付への申請が並行して作られた場合も、案件作成の検査がここで止める。
    return new ConflictError("erasure request conflicts", "erasure_duplicate", { cause: started })
  }
  return started
}

/**
 * 承認済みの消去案件を実行する。System operationが人の消去権限・承認済み状態・一回限りの実行許可を
 * 検査し、DEKの破棄と監査を同時に確定する。
 */
export async function executeSystemApplicationErasure(
  c: Context & { readonly var: Pick<Variables, "bearerReadAuthentication"> },
  number: number,
  executedAt: Date,
): Promise<
  | Readonly<{ kind: "destroyed" | "replayed"; attachmentIds: ReadonlyArray<string> }>
  | ApplicationError
> {
  const authentication = c.var.bearerReadAuthentication
  if (authentication === undefined)
    return new ForbiddenError("personal data erasure requires a person", "forbidden")
  const proposal = await systemProposalQuery(c).findByNumber(number)
  if (proposal instanceof Error)
    return new UnexpectedError("failed to find erasure request", { cause: proposal })
  if (proposal === null || proposal.completionOperationKey !== ATTACHMENT_ERASURE_OPERATION_KEY)
    return new NotFoundError("erasure request not found", "application_not_found")
  const executed = await executeSystemAttachmentErasure(
    { env: { DB: c.env.DB } },
    { authentication, proposal, executionGuards: [], at: executedAt },
  )
  if (executed instanceof AttachmentErasureError) return toErasureApplicationError(executed)
  return { kind: executed.kind, attachmentIds: executed.attachmentIds }
}
