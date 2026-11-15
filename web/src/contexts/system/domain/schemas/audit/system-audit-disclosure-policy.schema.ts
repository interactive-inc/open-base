import { z } from "zod"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

export const auditDisclosureFieldSchema = z.enum([
  "actor_account_id",
  "target_id",
  "reason_code",
  "authorization_json",
  "before_json",
  "after_json",
  "metadata_json",
])

const fields = z
  .array(auditDisclosureFieldSchema)
  .max(7)
  .refine((values) => new Set(values).size === values.length)
  .transform((values) => values.toSorted())
  .readonly()
const labels = z
  .array(z.string().trim().min(1).max(100))
  .max(64)
  .refine((values) => new Set(values).size === values.length)
  .transform((values) => values.toSorted())
  .readonly()
  .nullable()

export const auditDisclosureCommandSchema = z.strictObject({
  scope: z.union([z.literal("*"), zAccountId]),
  commandId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
  enabled: z.boolean(),
  allowedFields: fields,
  allowedTargetTypes: labels,
  allowedPurposes: labels,
  expiresAt: z.iso
    .datetime()
    .transform((value) => new Date(value).toISOString())
    .nullable(),
  reason: z.string().trim().min(1).max(1000),
  actorAccountId: zAccountId,
  supersedesLegacyRevision: z.number().int().positive().optional(),
})

export const auditDisclosurePolicySchema = auditDisclosureCommandSchema
  .omit({ expectedRevision: true })
  .extend({
    revision: z.number().int().positive(),
    recordedAt: z.iso.datetime(),
    auditEventId: z.uuid(),
  })

/** 保存済みの識別子は移行前の表記を保持する。新規命令の検証には使わない。 */
export const auditDisclosureStoredPolicySchema = auditDisclosurePolicySchema.extend({
  scope: z.string().min(1).max(255),
  actorAccountId: z.string().min(1).max(255),
  supersededByAuditEventId: z.uuid().optional(),
})
