import { z } from "zod"

export const preservedRecordDisclosureCommandSchema = z.strictObject({
  recordId: z.uuid(),
  action: z.enum(["read", "export"]),
  purpose: z.string().min(1).max(255),
})
