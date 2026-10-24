import type { OrganizationUnitPeriod } from "@/contexts/company/domain/definitions/organization-unit.definition"
import type {
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
} from "@/contexts/company/domain/definitions/workforce-schedule.definition"

export type OrganizationChangeVersionedPeriod =
  | OrganizationUnitPeriod
  | OrgAssignmentPeriod
  | OrgResponsibilityPeriod
