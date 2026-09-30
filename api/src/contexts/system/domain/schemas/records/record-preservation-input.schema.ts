import { z } from "zod"
import { attachmentPreservationCommandSchema } from "@system/domain/schemas/attachments/attachment-preservation.schema"
export const preservedRecordSnapshotSchema = z
  .object({
    id: z.uuid(),
    source: z.unknown(),
    attachmentId: z.uuid(),
    attachmentDigest: z.string().regex(/^[0-9a-f]{64}$/),
    preservationId: z.uuid(),
    disclosurePolicyId: z.uuid(),
    disclosurePolicyRevision: z.number().int().positive().safe(),
    sourceAuthorizationRef: z
      .object({
        context: z.string().regex(/^\S{1,255}$/),
        kind: z.string().regex(/^\S{1,255}$/),
        id: z.string().regex(/^\S{1,255}$/),
        version: z.string().regex(/^\S{1,255}$/),
      })
      .strict(),
    actorAccountId: z.string().regex(/^\S{1,255}$/),
    finalizedAt: z
      .string()
      .datetime()
      .transform((value) => new Date(value).toISOString()),
    reason: z.string().trim().min(1).max(1000),
    auditEventId: z.uuid(),
  })
  .strict()

const grantSchema = z
  .object({
    accountId: z.string().regex(/^\S{1,255}$/),
    actions: z
      .array(z.enum(["read", "export"]))
      .min(1)
      .max(2)
      .refine((values) => new Set(values).size === values.length)
      .readonly(),
    purposes: z
      .array(z.string().trim().min(1).max(255))
      .min(1)
      .max(20)
      .refine((values) => new Set(values).size === values.length)
      .readonly(),
    validFrom: z.string().datetime(),
    validUntil: z.string().datetime().nullable(),
  })
  .strict()
  .readonly()

export const preservedRecordDisclosurePolicySchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().positive().safe(),
    recordId: z.uuid(),
    status: z.enum(["active", "revoked"]),
    publishedAt: z
      .string()
      .datetime()
      .transform((value) => new Date(value).toISOString()),
    actorAccountId: z.string().regex(/^\S{1,255}$/),
    reason: z.string().trim().min(1).max(1000),
    auditEventId: z.uuid(),
    grants: z
      .array(grantSchema)
      .max(1000)
      .refine(
        (grants) =>
          new Set(grants.map((grant) => grant.accountId)).size === grants.length &&
          grants.every(
            (grant) =>
              grant.validUntil === null ||
              Date.parse(grant.validFrom) < Date.parse(grant.validUntil),
          ),
        "duplicate account or invalid disclosure period",
      )
      .readonly(),
  })
  .strict()
  .readonly()

export const recordPreservationIntentSchema = preservedRecordSnapshotSchema
  .pick({
    source: true,
    actorAccountId: true,
    reason: true,
    attachmentId: true,
    attachmentDigest: true,
    sourceAuthorizationRef: true,
  })
  .extend({
    version: z.literal(1),
    operation: z.literal("system.record.preserve"),
    recordId: z.uuid(),
    preservation: attachmentPreservationCommandSchema.pick({
      id: true,
      kind: true,
      retainUntil: true,
      reason: true,
    }),
    disclosure: preservedRecordDisclosurePolicySchema
      .unwrap()
      .pick({
        id: true,
        revision: true,
        reason: true,
        grants: true,
      })
      .extend({ revision: z.literal(1) }),
  })
  .strict()

/** 申請者が選ぶ保持条件と開示条件。元記録・実行主体・保存先・承認証拠はサーバーが確定する。 */
export const recordPreservationRequestSchema = z
  .object({
    reason: preservedRecordSnapshotSchema.shape.reason,
    preservation: recordPreservationIntentSchema.shape.preservation.omit({ id: true }),
    disclosure: recordPreservationIntentSchema.shape.disclosure.omit({ id: true, revision: true }),
  })
  .strict()
  .refine(
    (request) =>
      (request.preservation.kind === "hold" && request.preservation.retainUntil === null) ||
      (request.preservation.kind === "retention" && request.preservation.retainUntil !== null),
    "preservation kind and deadline do not match",
  )
  .readonly()
