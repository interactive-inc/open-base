import { InvalidSystemAuditEventError } from "@system/domain/errors"

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
}
