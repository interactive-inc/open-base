import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { InvalidSystemAuditEventError } from "@system/domain/errors"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SessionId } from "@system/domain/schemas/auth/session-id.schema"
import type { SystemAuditJsonValue } from "@system/domain/definitions/audit/system-audit-json-value.definition"
import type { SystemSessionAuditContext } from "@system/domain/definitions/audit/system-session-audit-context.definition"
import type { SessionRotationAuditEvents } from "@system/domain/definitions/auth/session-rotation-audit-events.definition"
import type { SessionRotationValue } from "@system/domain/values/auth/session-rotation.value"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"

/** 永続化方式を露出しない、opaqueなSystem識別子。 */
export type SystemAuditIdentifier = string
export type SystemAuditOutcome = "succeeded" | "denied" | "failed"

export type SystemAuditEventInput<
  ActorAccountId extends SystemAuditIdentifier = SystemAuditIdentifier,
> = Readonly<{
  actorAccountId: ActorAccountId | null
  action: string
  targetType: string
  targetId: string | null
  outcome: SystemAuditOutcome
  reasonCode: string | null
  authorizationJson: string | null
  beforeJson: string | null
  afterJson: string | null
  metadataJson: string | null
  occurredAt: Date
}>

export type SystemAuditEventProps<
  ActorAccountId extends SystemAuditIdentifier = SystemAuditIdentifier,
> = Omit<SystemAuditEventInput<ActorAccountId>, "occurredAt"> &
  Readonly<{
    eventId: string
    occurredAtEpochMilliseconds: number
  }>

const vocabularyPattern = /^[a-z][a-z0-9_-]*(?:[.:][a-z][a-z0-9_-]*)*$/u

function isJson(value: string | null): boolean {
  if (value === null) return true
  if (typeof value !== "string") return false
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

function isCanonical<ActorAccountId extends SystemAuditIdentifier>(
  props: SystemAuditEventProps<ActorAccountId>,
): boolean {
  return (
    typeof props.eventId === "string" &&
    props.eventId.length >= 1 &&
    props.eventId.length <= 256 &&
    (props.actorAccountId === null ||
      (typeof props.actorAccountId === "string" &&
        props.actorAccountId.trim().length >= 1 &&
        props.actorAccountId.length <= 256)) &&
    typeof props.action === "string" &&
    props.action.length <= 200 &&
    vocabularyPattern.test(props.action) &&
    typeof props.targetType === "string" &&
    props.targetType.length <= 100 &&
    vocabularyPattern.test(props.targetType) &&
    (props.targetId === null ||
      (typeof props.targetId === "string" &&
        props.targetId.length >= 1 &&
        props.targetId.length <= 512)) &&
    (props.outcome === "succeeded" || props.outcome === "denied" || props.outcome === "failed") &&
    (props.reasonCode === null ||
      (typeof props.reasonCode === "string" &&
        props.reasonCode.length >= 1 &&
        props.reasonCode.length <= 200)) &&
    isJson(props.authorizationJson) &&
    isJson(props.beforeJson) &&
    isJson(props.afterJson) &&
    isJson(props.metadataJson) &&
    Number.isSafeInteger(props.occurredAtEpochMilliseconds) &&
    Number.isFinite(new Date(props.occurredAtEpochMilliseconds).getTime())
  )
}

/** System上の重要操作を、変更不能なappend-only監査事実として表すEntity。 */
export class SystemAuditEventEntity<
  ActorAccountId extends SystemAuditIdentifier = SystemAuditIdentifier,
> {
  readonly eventId: string
  readonly actorAccountId: ActorAccountId | null
  readonly action: string
  readonly targetType: string
  readonly targetId: string | null
  readonly outcome: SystemAuditOutcome
  readonly reasonCode: string | null
  readonly authorizationJson: string | null
  readonly beforeJson: string | null
  readonly afterJson: string | null
  readonly metadataJson: string | null
  readonly occurredAtEpochMilliseconds: number

  private constructor(props: SystemAuditEventProps<ActorAccountId>) {
    this.eventId = props.eventId
    this.actorAccountId = props.actorAccountId
    this.action = props.action
    this.targetType = props.targetType
    this.targetId = props.targetId
    this.outcome = props.outcome
    this.reasonCode = props.reasonCode
    this.authorizationJson = props.authorizationJson
    this.beforeJson = props.beforeJson
    this.afterJson = props.afterJson
    this.metadataJson = props.metadataJson
    this.occurredAtEpochMilliseconds = props.occurredAtEpochMilliseconds
    Object.freeze(this)
  }

  static create<ActorAccountId extends SystemAuditIdentifier>(
    input: SystemAuditEventInput<ActorAccountId>,
  ): SystemAuditEventEntity<ActorAccountId> | InvalidSystemAuditEventError {
    let occurredAtEpochMilliseconds: number
    try {
      occurredAtEpochMilliseconds = Date.prototype.getTime.call(input.occurredAt)
    } catch (cause) {
      return new InvalidSystemAuditEventError(cause)
    }

    return SystemAuditEventEntity.restore({
      ...input,
      eventId: crypto.randomUUID(),
      occurredAtEpochMilliseconds,
    })
  }

  static restore<ActorAccountId extends SystemAuditIdentifier>(
    props: SystemAuditEventProps<ActorAccountId>,
  ): SystemAuditEventEntity<ActorAccountId> | InvalidSystemAuditEventError {
    return isCanonical(props)
      ? new SystemAuditEventEntity(props)
      : new InvalidSystemAuditEventError()
  }

  static createSession(
    props: Readonly<{
      actorAccountId: AccountId | null
      action:
        | typeof SYSTEM_AUDIT_ACTIONS.authSessionCreate
        | typeof SYSTEM_AUDIT_ACTIONS.authSessionRevoke
        | typeof SYSTEM_AUDIT_ACTIONS.authSessionRotate
      targetId: SessionId | null
      outcome: "succeeded" | "denied"
      reasonCode: "refresh_token_reused" | "session_invalid" | "session_lifetime_exceeded" | null
      occurredAt: Date
      context: SystemSessionAuditContext
    }>,
  ): SystemAuditEventEntity<AccountId> | InvalidSystemAuditEventError {
    return SystemAuditEventEntity.create({
      actorAccountId: props.actorAccountId,
      action: props.action,
      targetType: "session",
      targetId: props.targetId,
      outcome: props.outcome,
      reasonCode: props.reasonCode,
      authorizationJson: props.context.authorizationJson,
      beforeJson: null,
      afterJson: null,
      metadataJson: props.context.metadataJson,
      occurredAt: props.occurredAt,
    })
  }

  static createSessionRotationEvents(
    rotation: SessionRotationValue,
    context: SystemSessionAuditContext,
  ): SessionRotationAuditEvents | Error {
    const occurredAt = rotation.previous.rotatedAt
    if (occurredAt === null) return new Error("System Session rotation time is missing")

    const rotated = SystemAuditEventEntity.createSession({
      actorAccountId: rotation.previous.accountId,
      action: SYSTEM_AUDIT_ACTIONS.authSessionRotate,
      targetId: rotation.previous.id,
      outcome: "succeeded",
      reasonCode: null,
      occurredAt,
      context,
    })
    if (rotated instanceof Error) return rotated

    const reused = SystemAuditEventEntity.createSession({
      actorAccountId: rotation.previous.accountId,
      action: SYSTEM_AUDIT_ACTIONS.authSessionRotate,
      targetId: rotation.previous.id,
      outcome: "denied",
      reasonCode: "refresh_token_reused",
      occurredAt,
      context,
    })
    if (reused instanceof Error) return reused

    const invalid = SystemAuditEventEntity.createSession({
      actorAccountId: rotation.previous.accountId,
      action: SYSTEM_AUDIT_ACTIONS.authSessionRotate,
      targetId: rotation.previous.id,
      outcome: "denied",
      reasonCode: "session_invalid",
      occurredAt,
      context,
    })
    if (invalid instanceof Error) return invalid

    return Object.freeze({ rotated, reused, invalid })
  }

  static createOidc(
    props: Readonly<{
      accountId: AccountId
      action:
        | typeof SYSTEM_AUDIT_ACTIONS.authOidcAuthorization
        | typeof SYSTEM_AUDIT_ACTIONS.authOidcTokenExchange
      outcome: "succeeded" | "denied"
      reasonCode: "user_denied" | null
      authorization: SystemAuditJsonValue
      metadata: SystemAuditJsonValue
      occurredAt: Date
    }>,
  ): SystemAuditEventEntity<AccountId> | Error {
    const authorization = StableSystemAuditJsonValue.create(props.authorization)
    const metadata = StableSystemAuditJsonValue.create(props.metadata)
    if (authorization instanceof Error) return authorization
    if (metadata instanceof Error) return metadata

    return SystemAuditEventEntity.create({
      actorAccountId: props.accountId,
      action: props.action,
      targetType: "identity",
      targetId: props.accountId,
      outcome: props.outcome,
      reasonCode: props.reasonCode,
      authorizationJson: authorization?.toString() ?? null,
      beforeJson: null,
      afterJson: null,
      metadataJson: metadata?.toString() ?? null,
      occurredAt: props.occurredAt,
    })
  }
}
