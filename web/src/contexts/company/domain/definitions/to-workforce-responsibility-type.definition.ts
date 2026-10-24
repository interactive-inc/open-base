import type { OrgResponsibilityPeriod } from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import { restoreOrgResponsibilityType } from "@/contexts/company/domain/definitions/restore-org-responsibility-type.definition"

/** 人事発令の部署責任者表現を正規化し、その他の責務識別子を保持する。 */
export function toWorkforceResponsibilityType(
  value: OrgResponsibilityPeriod["responsibilityType"],
) {
  return restoreOrgResponsibilityType(value === "department_manager" ? "MANAGER" : value)
}
