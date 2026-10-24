import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import type { SystemJsonValue } from "@system/domain/definitions/audit/system-json-value.definition"
import {
  CompanyPayloadTooLargeError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { z } from "zod"

export const auditOutcomeSchema = z.enum(["succeeded", "denied", "failed"])
export const auditClientNameSchema = z.enum(["web", "cli", "api", "system"])
export const auditRequestContextSchema = z.strictObject({
  requestId: z.string().uuid(),
  clientName: auditClientNameSchema,
  clientIp: z.string().nullable(),
  externalRequestId: z.string().nullable(),
})

const actorIdSchema = zAccountId.nullable()
const actionSchema = z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u)
const targetTypeSchema = z.string().regex(/^[a-z][a-z0-9_]*$/u)
const targetSchema = z.strictObject({ type: targetTypeSchema, id: z.string().min(1).nullable() })
const eventTimeSchema = z.date()
const eventEnvelopeSchema = z.strictObject({
  actorAccountId: actorIdSchema,
  action: actionSchema,
  target: targetSchema,
  outcome: auditOutcomeSchema,
  reasonCode: z.string().nullable(),
  authorization: z.unknown().optional(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  metadata: z.unknown().optional(),
  now: z.unknown(),
})

export type AuditOutcome = z.infer<typeof auditOutcomeSchema>
export type AuditClientName = z.infer<typeof auditClientNameSchema>
export type AuditRequestContext = z.infer<typeof auditRequestContextSchema>
export type AuditJsonValue = SystemJsonValue

/** Company監査表へ投影するrequest文脈付きrecord。System永続化モデルとは共有しない。 */
export type CompanyAuditRecord = Readonly<{
  eventId: string
  requestId: string
  actorAccountId: AccountId | null
  action: string
  targetType: string
  targetId: string | null
  outcome: AuditOutcome
  reasonCode: string | null
  authorizationJson: string | null
  beforeJson: string | null
  afterJson: string | null
  metadataJson: string | null
  clientIp: string | null
  clientName: AuditClientName
  createdAt: number
}>

export type CompanyAuditRecordInput = Readonly<{
  actorAccountId: AccountId | null
  action: string
  target: Readonly<{ type: string; id: string | null }>
  outcome: AuditOutcome
  reasonCode: string | null
  authorization?: AuditJsonValue
  before?: AuditJsonValue
  after?: AuditJsonValue
  metadata?: AuditJsonValue
  now: Date
}>

export type CompanyAuditSummary = Readonly<{
  eventId: string
  requestId: string
  actorAccountId: AccountId | null
  action: string
  targetType: string | null
  targetId: string | null
  outcome: AuditOutcome
  reasonCode: string | null
  clientName: AuditClientName
  createdAt: number
}>

export type CompanyAuditDetail = CompanyAuditSummary &
  Readonly<{
    authorizationJson: string | null
    beforeJson: string | null
    afterJson: string | null
    metadataJson: string | null
    clientIp: string | null
  }>

function parseManagedValue<Output>(
  schema: z.ZodType<Output>,
  value: unknown,
  message: string,
  code: string,
): Output {
  let parsed: ReturnType<typeof schema.safeParse>
  try {
    parsed = schema.safeParse(value)
  } catch (error) {
    throw new CompanyValidationError(message, code, { cause: error })
  }
  if (!parsed.success) {
    throw new CompanyValidationError(message, code, { cause: parsed.error })
  }
  return parsed.data
}

function serializeOptionalProjection(value: AuditJsonValue | undefined): string | null {
  if (value === undefined) return null
  const serialized = CanonicalSystemJsonValue.create(value)
  if (serialized instanceof Error) {
    throw new CompanyValidationError(
      "audit JSON contains an unsupported value",
      "audit_invalid_json",
      {
        cause: serialized,
      },
    )
  }
  if (new TextEncoder().encode(serialized.toString()).byteLength > 65_536) {
    throw new CompanyPayloadTooLargeError(
      "audit JSON exceeds the 64 KiB limit",
      "audit_payload_too_large",
    )
  }
  return serialized.toString()
}

/** Account を主体とする汎用の append-only 監査エンベロープを生成する。 */
export function createCompanyAuditRecord(
  input: CompanyAuditRecordInput,
  context: AuditRequestContext,
): CompanyAuditRecord {
  const eventInput = parseManagedValue(
    eventEnvelopeSchema,
    input,
    "audit event input is invalid",
    "audit_invalid_event",
  )
  const auditContext = parseManagedValue(
    auditRequestContextSchema,
    context,
    "audit request context is invalid",
    "audit_invalid_context",
  )
  const eventTime = parseManagedValue(
    eventTimeSchema,
    eventInput.now,
    "audit event time is invalid",
    "audit_invalid_timestamp",
  )
  const timestamp = Date.prototype.getTime.call(eventTime)
  if (!Number.isFinite(timestamp)) {
    throw new CompanyValidationError("audit event time is invalid", "audit_invalid_timestamp")
  }

  const event = SystemAuditEventEntity.create({
    actorAccountId: eventInput.actorAccountId,
    action: eventInput.action,
    targetType: eventInput.target.type,
    targetId: eventInput.target.id,
    outcome: eventInput.outcome,
    reasonCode: eventInput.reasonCode,
    authorizationJson: serializeOptionalProjection(input.authorization),
    beforeJson: serializeOptionalProjection(input.before),
    afterJson: serializeOptionalProjection(input.after),
    metadataJson: serializeOptionalProjection(input.metadata),
    occurredAt: eventTime,
  })
  if (event instanceof Error) {
    throw new CompanyValidationError("audit event input is invalid", "audit_invalid_event", {
      cause: event,
    })
  }

  return {
    eventId: event.eventId,
    requestId: auditContext.requestId,
    actorAccountId: eventInput.actorAccountId,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    outcome: event.outcome,
    reasonCode: event.reasonCode,
    authorizationJson: event.authorizationJson,
    beforeJson: event.beforeJson,
    afterJson: event.afterJson,
    metadataJson: event.metadataJson,
    clientIp: auditContext.clientIp,
    clientName: auditContext.clientName,
    createdAt: Math.floor(event.occurredAtEpochMilliseconds / 1_000),
  }
}
