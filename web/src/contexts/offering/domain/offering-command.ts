import { z } from "zod"
const name = z.string().trim().min(1).max(200)
export const offeringCommandSchema = z.strictObject({
  id: z.uuid(),
  expected_revision: z.number().int().min(0).max(2147483646),
  name,
  code: name,
  type: z.enum(["product", "service"]),
  status: z.enum(["active", "inactive"]),
  reason: z.string().trim().min(1).max(3000),
})
export type OfferingCommand = z.infer<typeof offeringCommandSchema>
