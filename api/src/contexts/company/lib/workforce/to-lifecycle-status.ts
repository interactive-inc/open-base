import type { EmploymentStatus } from "@/contexts/company/domain/definitions/employment-status.definition"
import type { LifecycleEmployeeStatus } from "@/contexts/company/domain/definitions/lifecycle-types.definition"

/** 共通Workforceの在籍状態を既存APIの語彙へ変換する。 */
export function toLifecycleStatus(status: EmploymentStatus): LifecycleEmployeeStatus {
  if (status === "PRE_HIRE") return "prehire"
  if (status === "ACTIVE") return "active"
  if (status === "ON_LEAVE") return "leave"

  return "retired"
}
