import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemWorkItemError } from "@system/domain/errors"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemWorkDigestValue } from "@system/domain/values/work/system-work-digest.value"
import {
  systemWorkCommandSchema,
  systemWorkItemSchema,
  systemWorkActorSchema,
  systemWorkAuthenticationSchema,
  type SystemWorkActor,
  type SystemWorkAuthentication,
  type SystemWorkCommand,
  type SystemWorkItem,
} from "@system/domain/schemas/work/system-work-item.schema"

const systemWorkAuditActions = Object.freeze({
  create: SYSTEM_AUDIT_ACTIONS.systemWorkCreate,
  accept: SYSTEM_AUDIT_ACTIONS.systemWorkAccept,
  submit: SYSTEM_AUDIT_ACTIONS.systemWorkSubmit,
  approve: SYSTEM_AUDIT_ACTIONS.systemWorkApprove,
  return: SYSTEM_AUDIT_ACTIONS.systemWorkReturn,
  request_handover: SYSTEM_AUDIT_ACTIONS.systemWorkRequestHandover,
  accept_handover: SYSTEM_AUDIT_ACTIONS.systemWorkAcceptHandover,
  decline_handover: SYSTEM_AUDIT_ACTIONS.systemWorkDeclineHandover,
  cancel: SYSTEM_AUDIT_ACTIONS.systemWorkCancel,
})

type Transition = Readonly<{
  command: unknown
  actor: SystemWorkActor
  authentication: SystemWorkAuthentication
  now: Date
  recipient?: SystemWorkActor
  recovery?: boolean
}>

function sameActor(left: SystemWorkActor, right: SystemWorkActor): boolean {
  return (
    left.accountId === right.accountId &&
    left.principalId === right.principalId &&
    left.kind === right.kind
  )
}

function requiresStepUp(kind: SystemWorkCommand["kind"]): boolean {
  return kind !== "create" && kind !== "accept" && kind !== "submit"
}

/** 依頼・成果・確認・責任者の引継ぎを、変更不能な版として保持する。 */
export class SystemWorkItemEntity {
  private constructor(readonly snapshot: SystemWorkItem) {
    Object.freeze(this)
  }

  static restore(input: unknown): SystemWorkItemEntity | SystemWorkItemError {
    const parsed = systemWorkItemSchema.safeParse(input)
    if (!parsed.success) return new SystemWorkItemError("invalid", parsed.error)
    const value = parsed.data
    if (
      Date.parse(value.createdAt) < 0 ||
      Date.parse(value.recordedAt) < Date.parse(value.createdAt) ||
      (value.dueAt !== null && Date.parse(value.dueAt) < Date.parse(value.createdAt)) ||
      (value.revision === 1) !== (value.action === "create") ||
      (value.state === "offered" && value.result !== null) ||
      ((value.state === "review_pending" || value.state === "completed") &&
        value.result === null) ||
      (value.state === "completed" && value.action !== "approve") ||
      (value.state === "cancelled" && value.action !== "cancel") ||
      ((value.state === "completed" || value.state === "cancelled") && value.handover !== null) ||
      (value.actor.kind === "human" && value.authentication.credentialId !== null) ||
      (value.actor.kind === "agent" &&
        (value.authentication.credentialId === null ||
          value.authentication.stepUpGrantId !== null)) ||
      (requiresStepUp(value.action) &&
        (value.actor.kind !== "human" || value.authentication.stepUpGrantId === null)) ||
      (value.recovery && value.action !== "request_handover")
    )
      return new SystemWorkItemError("invalid")
    if (
      value.result !== null &&
      (!sameActor(value.result.submittedBy, value.assignee) ||
        Date.parse(value.result.submittedAt) < Date.parse(value.createdAt) ||
        Date.parse(value.result.submittedAt) > Date.parse(value.recordedAt))
    )
      return new SystemWorkItemError("invalid")
    if (
      value.handover !== null &&
      (sameActor(value.handover.to, value.accountable) ||
        Date.parse(value.handover.requestedAt) < Date.parse(value.createdAt) ||
        Date.parse(value.handover.requestedAt) > Date.parse(value.recordedAt))
    )
      return new SystemWorkItemError("invalid")
    if (
      value.state === "completed" &&
      (!sameActor(value.actor, value.accountable) ||
        value.actor.principalId === value.result?.submittedBy.principalId ||
        value.actor.accountId === value.result?.submittedBy.accountId)
    )
      return new SystemWorkItemError("invalid")
    if (
      value.action === "create" &&
      (value.state !== "offered" ||
        value.result !== null ||
        value.handover !== null ||
        value.createdAt !== value.recordedAt ||
        !sameActor(value.actor, value.createdBy) ||
        !sameActor(value.accountable, value.createdBy) ||
        value.previousRevisionId === value.commandId)
    )
      return new SystemWorkItemError("invalid")
    if (
      value.action === "accept" &&
      (value.state !== "active" ||
        value.result !== null ||
        value.handover !== null ||
        !sameActor(value.actor, value.assignee))
    )
      return new SystemWorkItemError("invalid")
    if (
      value.action === "submit" &&
      (value.state !== "review_pending" ||
        value.result?.id !== value.commandId ||
        value.result.submittedAt !== value.recordedAt ||
        value.handover !== null ||
        !sameActor(value.actor, value.assignee))
    )
      return new SystemWorkItemError("invalid")
    if (
      value.action === "return" &&
      (value.state !== "active" ||
        value.result === null ||
        value.handover !== null ||
        !sameActor(value.actor, value.accountable))
    )
      return new SystemWorkItemError("invalid")
    if (
      value.action === "request_handover" &&
      (value.handover?.id !== value.commandId ||
        value.handover.requestedAt !== value.recordedAt ||
        !sameActor(value.actor, value.handover.requestedBy) ||
        (!value.recovery && !sameActor(value.actor, value.accountable)))
    )
      return new SystemWorkItemError("invalid")
    if (
      value.action === "accept_handover" &&
      (value.handover !== null || !sameActor(value.actor, value.accountable))
    )
      return new SystemWorkItemError("invalid")
    if (
      value.action === "decline_handover" &&
      (value.handover !== null || sameActor(value.actor, value.accountable))
    )
      return new SystemWorkItemError("invalid")
    if (value.action === "cancel" && !sameActor(value.actor, value.accountable))
      return new SystemWorkItemError("invalid")
    return new SystemWorkItemEntity(value)
  }

  static async create(input: Transition): Promise<SystemWorkItemEntity | SystemWorkItemError> {
    const parsed = systemWorkCommandSchema.safeParse(input.command)
    const actor = systemWorkActorSchema.safeParse(input.actor)
    const authentication = systemWorkAuthenticationSchema.safeParse(input.authentication)
    if (
      !parsed.success ||
      parsed.data.kind !== "create" ||
      !actor.success ||
      !authentication.success ||
      !Number.isSafeInteger(input.now.getTime()) ||
      input.now.getTime() < 0
    )
      return new SystemWorkItemError("invalid")
    const command = parsed.data
    const assignee = systemWorkActorSchema.safeParse(input.recipient)
    if (!assignee.success || assignee.data.accountId !== command.assigneeAccountId)
      return new SystemWorkItemError("invalid")
    if (actor.data.kind !== "human") return new SystemWorkItemError("forbidden")
    const requestDigest = await SystemWorkDigestValue.create({ command, actor: actor.data })
    if (requestDigest instanceof Error) return requestDigest
    return SystemWorkItemEntity.restore({
      id: command.id,
      revision: 1,
      commandId: command.commandId,
      requestDigest: requestDigest.toString(),
      action: "create",
      title: command.title,
      instructions: command.instructions,
      acceptanceCriteria: command.acceptanceCriteria,
      dueAt: command.dueAt,
      previousRevisionId: command.previousRevisionId,
      createdBy: actor.data,
      createdAt: input.now.toISOString(),
      assignee: assignee.data,
      accountable: actor.data,
      state: "offered",
      result: null,
      handover: null,
      actor: actor.data,
      authentication: authentication.data,
      recovery: false,
      reason: command.reason,
      recordedAt: input.now.toISOString(),
      auditEventId: crypto.randomUUID(),
    })
  }

  async transition(input: Transition): Promise<SystemWorkItemEntity | SystemWorkItemError> {
    const parsed = systemWorkCommandSchema.safeParse(input.command)
    const actor = systemWorkActorSchema.safeParse(input.actor)
    const authentication = systemWorkAuthenticationSchema.safeParse(input.authentication)
    if (
      !parsed.success ||
      parsed.data.kind === "create" ||
      !actor.success ||
      !authentication.success ||
      !Number.isSafeInteger(input.now.getTime())
    )
      return new SystemWorkItemError("invalid")
    const command = parsed.data
    const previous = this.snapshot
    if (
      command.id !== previous.id ||
      command.expectedRevision !== previous.revision ||
      previous.revision === Number.MAX_SAFE_INTEGER ||
      input.now.getTime() < Date.parse(previous.recordedAt) ||
      previous.state === "completed" ||
      previous.state === "cancelled"
    )
      return new SystemWorkItemError("conflict")
    if (
      requiresStepUp(command.kind) &&
      (actor.data.kind !== "human" || authentication.data.stepUpGrantId === null)
    )
      return new SystemWorkItemError("forbidden")
    if (
      previous.handover !== null &&
      command.kind !== "accept_handover" &&
      command.kind !== "decline_handover" &&
      command.kind !== "cancel" &&
      !(command.kind === "request_handover" && input.recovery === true)
    )
      return new SystemWorkItemError("conflict")
    const requestDigest = await SystemWorkDigestValue.create({ command, actor: actor.data })
    if (requestDigest instanceof Error) return requestDigest
    const next = {
      ...previous,
      revision: previous.revision + 1,
      commandId: command.commandId,
      action: command.kind,
      requestDigest: requestDigest.toString(),
      actor: actor.data,
      authentication: authentication.data,
      recovery: false,
      reason: command.reason,
      recordedAt: input.now.toISOString(),
      auditEventId: crypto.randomUUID(),
    }
    switch (command.kind) {
      case "accept":
        if (!sameActor(actor.data, previous.assignee)) return new SystemWorkItemError("forbidden")
        if (previous.state !== "offered") return new SystemWorkItemError("conflict")
        next.state = "active"
        break
      case "submit": {
        if (!sameActor(actor.data, previous.assignee)) return new SystemWorkItemError("forbidden")
        if (previous.state !== "active") return new SystemWorkItemError("conflict")
        const digest = await SystemWorkDigestValue.create({
          workItemId: previous.id,
          acceptanceCriteria: previous.acceptanceCriteria,
          instructions: previous.instructions,
          resultId: command.commandId,
          ...command.result,
        })
        if (digest instanceof Error) return digest
        next.result = {
          id: command.commandId,
          ...command.result,
          digest: digest.toString(),
          submittedAt: input.now.toISOString(),
          submittedBy: actor.data,
        }
        next.state = "review_pending"
        break
      }
      case "approve":
      case "return":
        if (!sameActor(actor.data, previous.accountable))
          return new SystemWorkItemError("forbidden")
        if (
          previous.state !== "review_pending" ||
          previous.result?.id !== command.resultId ||
          previous.result.digest !== command.resultDigest
        )
          return new SystemWorkItemError("conflict")
        if (
          command.kind === "approve" &&
          (actor.data.accountId === previous.result.submittedBy.accountId ||
            actor.data.principalId === previous.result.submittedBy.principalId)
        )
          return new SystemWorkItemError("forbidden")
        next.state = command.kind === "approve" ? "completed" : "active"
        break
      case "request_handover": {
        if (!sameActor(actor.data, previous.accountable) && input.recovery !== true)
          return new SystemWorkItemError("forbidden")
        const recipient = systemWorkActorSchema.safeParse(input.recipient)
        if (
          !recipient.success ||
          recipient.data.kind !== "human" ||
          recipient.data.accountId !== command.toAccountId ||
          sameActor(recipient.data, previous.accountable)
        )
          return new SystemWorkItemError("invalid")
        next.handover = {
          id: command.commandId,
          to: { ...recipient.data, kind: "human" },
          requestedBy: { ...actor.data, kind: "human" },
          requestedAt: input.now.toISOString(),
          reason: command.reason,
        }
        next.recovery = previous.handover !== null || !sameActor(actor.data, previous.accountable)
        break
      }
      case "accept_handover":
      case "decline_handover":
        if (previous.handover === null || previous.handover.id !== command.handoverId)
          return new SystemWorkItemError("conflict")
        if (!sameActor(actor.data, previous.handover.to))
          return new SystemWorkItemError("forbidden")
        if (command.kind === "accept_handover") next.accountable = previous.handover.to
        next.handover = null
        break
      case "cancel":
        if (!sameActor(actor.data, previous.accountable))
          return new SystemWorkItemError("forbidden")
        next.state = "cancelled"
        next.handover = null
        break
    }
    return SystemWorkItemEntity.restore(next)
  }

  async matches(command: unknown, actor: SystemWorkActor): Promise<boolean> {
    const parsed = systemWorkCommandSchema.safeParse(command)
    if (!parsed.success) return false
    const digest = await SystemWorkDigestValue.create({ command: parsed.data, actor })
    return (
      digest instanceof SystemWorkDigestValue && digest.toString() === this.snapshot.requestDigest
    )
  }

  async verifyResult(): Promise<boolean> {
    const value = this.snapshot
    if (value.result === null) return true
    const digest = await SystemWorkDigestValue.create({
      workItemId: value.id,
      acceptanceCriteria: value.acceptanceCriteria,
      instructions: value.instructions,
      resultId: value.result.id,
      summary: value.result.summary,
      evidence: value.result.evidence,
    })
    return digest instanceof SystemWorkDigestValue && digest.toString() === value.result.digest
  }

  audit(before: SystemWorkItemEntity | null): SystemAuditEventEntity | Error {
    const value = this.snapshot
    return SystemAuditEventEntity.restore({
      eventId: value.auditEventId,
      actorAccountId: value.actor.accountId,
      action: systemWorkAuditActions[value.action],
      targetType: "system:work-item",
      targetId: value.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        principal_id: value.actor.principalId,
        principal_kind: value.actor.kind,
        token_version: value.authentication.tokenVersion,
        credential_id: value.authentication.credentialId,
        step_up_grant_id: value.authentication.stepUpGrantId,
        recovery: value.recovery,
      }),
      beforeJson: before === null ? null : JSON.stringify(before.snapshot),
      afterJson: JSON.stringify(value),
      metadataJson: null,
      occurredAtEpochMilliseconds: Date.parse(value.recordedAt),
    })
  }
}
