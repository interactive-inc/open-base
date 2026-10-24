import { z } from "zod"

/** 添付DEKの破棄を申請する範囲。個別の添付か、Accountが所有する添付の全体を指す。 */
export const attachmentErasureScopeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("attachment"), attachmentId: z.string().min(1).max(64) }),
  z.strictObject({ kind: z.literal("account"), accountId: z.string().min(1).max(255) }),
])

const attachmentIdsSchema = z
  .array(z.string().min(1).max(64))
  .max(1000)
  .refine(
    (ids) => ids.every((id, index) => index === 0 || (ids[index - 1] ?? "") < id),
    "attachment ids must be sorted and unique",
  )

/** 承認手続へ固定する消去申請の本文。承認digestはこの本文全体から計算される。 */
export const attachmentErasureRequestBodySchema = z.strictObject({
  operation: z.literal("system.attachment.erase"),
  requestId: z.uuid(),
  scope: attachmentErasureScopeSchema,
  reason: z.string().trim().min(1).max(1000),
  requestedByAccountId: z.string().min(1).max(255),
  requestedAt: z.iso.datetime(),
  targetAttachmentIds: attachmentIdsSchema.refine((ids) => ids.length > 0),
  preservedAttachmentIds: attachmentIdsSchema,
})

export type AttachmentErasureScope = z.infer<typeof attachmentErasureScopeSchema>
export type AttachmentErasureRequestBody = z.infer<typeof attachmentErasureRequestBodySchema>
