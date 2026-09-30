import { attachmentPreservationSnapshotSchema } from "@system/domain/schemas/attachments/attachment-preservation.schema"
import { z } from "zod"

export const attachmentPreservationResponseSchema = z.strictObject({
  preservation: attachmentPreservationSnapshotSchema,
  replayed: z.boolean(),
})

export const attachmentPreservationListResponseSchema = z.strictObject({
  preservations: z.array(attachmentPreservationSnapshotSchema).max(100),
  next_cursor: z.uuid().nullable(),
})
