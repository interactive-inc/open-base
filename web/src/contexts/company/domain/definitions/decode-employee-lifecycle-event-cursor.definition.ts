import { CompanyValidationError } from "@/contexts/company/domain/errors"
import { z } from "zod"

const cursorSchema = z.object({
  version: z.literal(1),
  employeeId: z.string().min(1),
  from: z.string().nullable(),
  to: z.string().nullable(),
  anchorRowId: z.number().int().nonnegative(),
  eventOn: z.string(),
  recordedAt: z.number().int().nonnegative(),
  id: z.string().min(1),
  limit: z.number().int().min(1).max(100),
})

export type EmployeeLifecycleEventCursor = z.infer<typeof cursorSchema>

export function decodeEmployeeLifecycleEventCursor(
  value: string,
): EmployeeLifecycleEventCursor | CompanyValidationError {
  try {
    return cursorSchema.parse(JSON.parse(atob(value.replaceAll("-", "+").replaceAll("_", "/"))))
  } catch (cause) {
    return new CompanyValidationError("履歴カーソルが不正です", "invalid_lifecycle_cursor", {
      cause,
    })
  }
}
