import { z } from "zod"

export const personnelPositionReferenceSchema = z.strictObject({
  organizationId: z.string().min(1).max(255),
  organizationRevision: z.number().int().nonnegative(),
  resourceId: z.string().min(1).max(255),
  resourceRevision: z.number().int().positive(),
  code: z.string().min(1).max(200),
  effectiveOn: z.string().date(),
})

export type PersonnelPositionReference = z.infer<typeof personnelPositionReferenceSchema>
