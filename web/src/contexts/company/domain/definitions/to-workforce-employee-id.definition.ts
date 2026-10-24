import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export function toWorkforceEmployeeId(value: number | string): EmployeeId {
  return restoreWorkforceId("employee", String(value))
}
