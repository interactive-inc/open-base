import { z } from "zod"
import { systemWorkItemSchema } from "@system/domain/schemas/work/system-work-item.schema"

export const systemWorkItemResponseSchema = z.strictObject({ workItem: systemWorkItemSchema })
export const systemWorkCommandResponseSchema = systemWorkItemResponseSchema.extend({
  replayed: z.boolean(),
})
export const systemWorkListResponseSchema = z.strictObject({
  workItems: z.array(systemWorkItemSchema).max(50),
  nextCursor: z.uuid().nullable(),
})
export const systemWorkHistoryResponseSchema = z.strictObject({
  revisions: z.array(systemWorkItemSchema).max(50),
  nextRevision: z.number().int().positive().nullable(),
})
