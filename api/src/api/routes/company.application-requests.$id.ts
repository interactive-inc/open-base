import { resolveActiveCompanyAccountParticipant } from "@/api/http/accounts/resolve-active-company-account-participant"
import { resolveCompanyAccountParticipants } from "@/api/http/accounts/resolve-company-account-participants"
import { resolveActiveSystemAccountId } from "@/api/http/accounts/resolve-active-system-account-id"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/parse-company-procedure-decision.policy"
import {
  reviseSystemApplication,
  systemProposalQuery,
  withdrawSystemApplication,
} from "@/api/http/application-requests/lib/system-application-operation"
import {
  parseSystemApplicationBody,
  toApplicationCurrentStep,
  toApplicationStatus,
} from "@/api/http/application-requests/lib/system-application-view"
import { factory } from "@/api/http/factory"
import { jsonPayloadSchema } from "@/lib/http/json-payload-schema"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ForbiddenError, InternalError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { zAppApplication, zAppApplicationUpdated } from "@/api/http/company/response-schemas"
import { ApplicationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { parseJsonValue } from "@/api/http/application-requests/lib/parse-json-value"
import { toApplicationDecisionTarget } from "@/api/http/application-requests/lib/to-application-decision-target"

// @authorization service - System証拠とCompany主体を合成して所有者・候補者・監査者を判定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const number = validateIntParam(c.req.param("id"), "application")
  const query = systemProposalQuery(c)
  const proposal = await query.findByNumber(number)
  if (proposal instanceof Error) throw new InternalError("failed to load application")
  if (proposal === null || proposal.status === "cancelled") {
    throw new NotFoundError("application not found")
  }
  const actorAccountId = await resolveActiveSystemAccountId(c, session.accountId)
  if (actorAccountId instanceof Error) {
    throw new InternalError("failed to resolve canonical workflow actor")
  }
  const owner = proposal.createdByAccountId === actorAccountId
  const attestations = await query.listAttestations(proposal.caseId)
  if (attestations instanceof Error) throw new InternalError("failed to load decisions")
  let participant = attestations.some(
    (attestation) =>
      attestation.actorAccountId === actorAccountId ||
      attestation.representedAccountId === actorAccountId,
  )
  let currentCandidate = false
  let representedAccountId = actorAccountId
  if (!owner && proposal.status === "pending" && proposal.currentTaskKey !== null) {
    const candidates = await query.listTaskCandidateAccountIds({
      caseId: proposal.caseId,
      taskKey: proposal.currentTaskKey,
      round: proposal.currentTaskRound ?? 1,
      at: new Date(c.env.NOW ?? Date.now()),
    })
    if (candidates instanceof Error) throw new InternalError("failed to load decision candidates")
    currentCandidate = candidates.includes(actorAccountId)
    if (!currentCandidate) {
      const delegation = await query.findDelegation({
        caseId: proposal.caseId,
        actorAccountId,
        candidateAccountIds: candidates,
        at: new Date(c.env.NOW ?? Date.now()),
      })
      if (delegation instanceof Error) throw new InternalError("failed to resolve delegation")
      currentCandidate = delegation !== null
      if (delegation !== null) representedAccountId = delegation.representedAccountId
    }
    participant = participant || currentCandidate
  }
  if (!owner && !participant && !session.hasPermission("application:read:all")) {
    throw new ForbiddenError()
  }
  const ownerParticipant = await resolveActiveCompanyAccountParticipant(
    c,
    proposal.createdByAccountId,
  )
  if (ownerParticipant instanceof Error || ownerParticipant === null) {
    throw new InternalError("failed to resolve application owner")
  }
  const accountIds = attestations.flatMap((attestation) => [
    attestation.actorAccountId,
    attestation.representedAccountId,
  ])
  const decisionParticipants = await resolveCompanyAccountParticipants(c, accountIds)
  if (decisionParticipants instanceof Error) {
    throw new InternalError("failed to resolve decision participants")
  }
  const participantNames = new Map(
    decisionParticipants.map((value) => [value.accountId, value.employeeName]),
  )
  const policyValue = parseJsonValue(proposal.decisionPolicyJson)
  const policy =
    policyValue instanceof Error
      ? policyValue
      : parseCompanyProcedureDecisionPolicy(policyValue.value)
  const payload = parseSystemApplicationBody(proposal)
  if (policy instanceof Error || payload instanceof Error) {
    throw new InternalError("invalid application data")
  }
  const tasks = await query.listTasks(proposal.caseId)
  if (tasks instanceof Error) throw new InternalError("failed to load workflow progress")
  const taskByKey = new Map(tasks.map((task) => [task.key, task]))
  const workflow =
    policy.workflow === null
      ? null
      : {
          current_step_key: proposal.lastTaskKey,
          current_round: proposal.lastTaskRound,
          started_at: tasks.at(0)?.openedAt.toISOString() ?? proposal.createdAt.toISOString(),
          due_at: proposal.currentTaskDueAt?.toISOString() ?? null,
          returned: proposal.status === "returned",
          steps: policy.workflow.steps.map((step) => {
            const task = taskByKey.get(step.key)
            return {
              key: step.key,
              name: step.name,
              rejection_behavior: step.rejection_behavior,
              status:
                task === undefined
                  ? "waiting"
                  : task.outcome === "pending"
                    ? "pending"
                    : task.outcome,
            }
          }),
          approvals: attestations.map((attestation, index) => ({
            id: index + 1,
            step_key: attestation.taskKey,
            round: attestation.round,
            approver_name: participantNames.get(attestation.actorAccountId) ?? "",
            represented_approver_name: participantNames.get(attestation.representedAccountId) ?? "",
            action: attestation.action,
            comment: attestation.comment,
            created_at: attestation.decidedAt.toISOString(),
          })),
        }

  return c.json(
    zAppApplication.parse({
      id: proposal.number,
      decision_target: toApplicationDecisionTarget(proposal),
      can_decide:
        currentCandidate &&
        !attestations.some(
          (attestation) =>
            attestation.taskKey === proposal.currentTaskKey &&
            attestation.round === proposal.currentTaskRound &&
            (attestation.actorAccountId === actorAccountId ||
              attestation.representedAccountId === representedAccountId),
        ),
      template_code: proposal.procedureKey,
      template_name: proposal.title,
      applicant_name: ownerParticipant.employeeName,
      subject: null,
      target_department: null,
      status: toApplicationStatus(proposal.status),
      current_step: toApplicationCurrentStep(proposal),
      payload: payload.value,
      created_at: proposal.createdAt.toISOString(),
      approvals:
        policy.workflow === null
          ? attestations
              .filter((attestation) => attestation.action !== "return")
              .map((attestation, index) => ({
                id: index + 1,
                approver_name: participantNames.get(attestation.actorAccountId) ?? "",
                action: attestation.action,
                comment: attestation.comment,
                created_at: attestation.decidedAt.toISOString(),
              }))
          : [],
      approver_roles: policy.approverRoles,
      workflow,
    }),
    200,
  )
})

// @authorization owner - 本人の未確定手続だけを新しいProposal版へ更新する
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.object({ payload: jsonPayloadSchema(10_000) })),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    const result = await reviseSystemApplication(c, {
      number: validateIntParam(c.req.param("id"), "application"),
      applicantId: session.employeeId,
      payload: c.req.valid("json").payload,
      revisedAt: new Date(c.env.NOW ?? Date.now()),
      mode: "edit",
    })
    if (result instanceof ApplicationError) throw toHttpException(result)
    const payload = parseSystemApplicationBody(result.proposal)
    if (payload instanceof Error) throw new InternalError("invalid application payload")

    return c.json(
      zAppApplicationUpdated.parse({
        id: result.proposal.number,
        status: toApplicationStatus(result.proposal.status),
        payload: payload.value,
      }),
      200,
    )
  },
)

// @authorization owner - 判断履歴を削除せず未完了Caseを取消す
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const result = await withdrawSystemApplication(c, {
    number: validateIntParam(c.req.param("id"), "application"),
    applicantId: session.employeeId,
    withdrawnAt: new Date(c.env.NOW ?? Date.now()),
  })
  if (result instanceof ApplicationError) throw toHttpException(result)

  return c.body(null, 204)
})
