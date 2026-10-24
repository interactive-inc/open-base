import { z } from "zod"
import { auditDisclosureFieldSchema } from "@system/domain/schemas/audit/system-audit-disclosure-policy.schema"

/** 開示条件を適用した読取結果。変更不能な監査事実そのものとは区別する。 */
export const systemAuditDisclosedEventSchema = z
  .strictObject({
    eventId: z.string().min(1).max(256),
    actorAccountId: z.string().nullable(),
    action: z.string().min(1).max(200),
    targetType: z.string().min(1).max(100),
    targetId: z.string().nullable(),
    outcome: z.enum(["succeeded", "denied", "failed"]),
    reasonCode: z.string().nullable(),
    authorizationJson: z.string().nullable(),
    beforeJson: z.string().nullable(),
    afterJson: z.string().nullable(),
    metadataJson: z.string().nullable(),
    occurredAtEpochMilliseconds: z
      .number()
      .int()
      .refine((value) => Number.isFinite(new Date(value).getTime())),
    redactedFields: z.array(auditDisclosureFieldSchema).readonly(),
  })
  .readonly()

export type SystemAuditDisclosedEvent = z.output<typeof systemAuditDisclosedEventSchema>
