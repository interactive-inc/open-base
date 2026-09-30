import { z } from "zod"

export const recordSourceFreezeSnapshotSchema = z.strictObject({
  id: z.string().uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  ownerContext: z.string().regex(/^[a-z][a-z0-9-]{0,99}$/),
  actorAccountId: z.string().min(1).max(255),
  reason: z.string().trim().min(1).max(2000),
  createdAt: z.string().datetime(),
  auditEventId: z.string().uuid(),
  revision: z.number().int().min(1).max(2),
  release: z
    .strictObject({
      actorAccountId: z.string().min(1).max(255),
      reason: z.string().trim().min(1).max(2000),
      at: z.string().datetime(),
      auditEventId: z.string().uuid(),
    })
    .nullable(),
})

export const recordSourceFreezeCommandSchema = recordSourceFreezeSnapshotSchema.pick({
  id: true,
  sourceNamespace: true,
  ownerContext: true,
  actorAccountId: true,
  reason: true,
})
