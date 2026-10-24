import { z } from "zod"

export const organizationProfileVersionSchema = z
  .object({
    organizationId: z.string().regex(/^\S{1,255}$/),
    organizationRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 1),
    resourceId: z
      .string()
      .regex(/^\S{1,255}$/)
      .nullable(),
    resourceRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 1),
    effectiveOn: z.string().date(),
    effectiveTo: z.string().date().nullable(),
    sourceFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
  .readonly()
export type OrganizationProfileVersion = z.infer<typeof organizationProfileVersionSchema>
