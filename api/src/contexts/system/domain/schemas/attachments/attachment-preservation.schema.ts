import { z } from "zod"

export const attachmentPreservationCommandSchema = z.strictObject({
  id: z.uuid(),
  attachmentId: z.string().min(1).max(64),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  kind: z.enum(["hold", "retention"]),
  retainUntil: z.iso
    .datetime()
    .transform((value) => new Date(value).toISOString())
    .nullable(),
  reason: z.string().trim().min(1).max(1000),
  actorAccountId: z.string().min(1).max(255),
})

export const attachmentPreservationReleaseSchema = z.strictObject({
  operationId: z.uuid(),
  reason: z.string().trim().min(1).max(1000),
  actorAccountId: z.string().min(1).max(255),
  at: z.iso.datetime(),
  auditEventId: z.uuid(),
})

export const attachmentPreservationSnapshotSchema = attachmentPreservationCommandSchema.extend({
  createdAt: z.iso.datetime(),
  auditEventId: z.uuid(),
  revision: z.union([z.literal(1), z.literal(2)]),
  release: attachmentPreservationReleaseSchema.nullable(),
})

export const attachmentPreservationReleaseCommandSchema = z.strictObject({
  id: z.uuid(),
  attachmentId: z.string().min(1).max(64),
  operationId: z.uuid(),
  expectedRevision: z.literal(1),
  reason: z.string().trim().min(1).max(1000),
  actorAccountId: z.string().min(1).max(255),
})
