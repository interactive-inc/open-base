import { z } from "zod"
import { auditDisclosurePolicySchema } from "@system/domain/schemas/audit/system-audit-disclosure-policy.schema"
import { systemAuditDisclosedEventSchema } from "@system/domain/schemas/audit/system-audit-disclosed-event.schema"

export const auditDisclosurePolicyResponseSchema = z.strictObject({
  policy: auditDisclosurePolicySchema,
  replayed: z.boolean(),
})
export const auditDisclosureCurrentPolicyResponseSchema = z.strictObject({
  policy: auditDisclosurePolicySchema.nullable(),
})
export const systemAuditEventResponseSchema = systemAuditDisclosedEventSchema.transform(
  (event) => ({
    event_id: event.eventId,
    actor_account_id: event.actorAccountId,
    action: event.action,
    target_type: event.targetType,
    target_id: event.targetId,
    outcome: event.outcome,
    reason_code: event.reasonCode,
    authorization_json: event.authorizationJson,
    before_json: event.beforeJson,
    after_json: event.afterJson,
    metadata_json: event.metadataJson,
    occurred_at: new Date(event.occurredAtEpochMilliseconds).toISOString(),
    redacted_fields: event.redactedFields,
  }),
)
