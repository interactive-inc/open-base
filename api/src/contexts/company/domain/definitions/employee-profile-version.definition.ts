import { z } from "zod"

export const employeeProfileVersionSchema = z
  .object({
    employeeId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
    organizationRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 1),
    personRevision: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER - 1),
    effectiveOn: z.string().date(),
  })
  .strict()
export type EmployeeProfileVersion = z.infer<typeof employeeProfileVersionSchema>
