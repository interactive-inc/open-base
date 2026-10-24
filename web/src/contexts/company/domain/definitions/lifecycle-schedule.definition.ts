import type { OrgResponsibilityType } from "@/contexts/company/domain/definitions/org-responsibility-type.definition"
import type {
  EmployeeId,
  EmploymentId,
  OrganizationUnitId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"

/** 有効日と訂正revisionを持つCompany従業員ライフサイクルの共通期間。 */
export type LifecyclePeriodBase = {
  periodId: string
  revision: number
  startsOn: string
  endsOn: string | null
  isVoid: boolean
  recordedByActionId: string
  recordedAt: number
}

export type EmploymentPeriod = LifecyclePeriodBase & {
  employeeId: EmployeeId
  employmentId: EmploymentId
}

export type EmployeeStatusPeriod = LifecyclePeriodBase & {
  employmentPeriodId: EmploymentId
  employeeId: EmployeeId
  status: "active" | "leave"
}

export type OrgAssignmentPeriod = LifecyclePeriodBase & {
  employmentPeriodId: EmploymentId
  employeeId: EmployeeId
  organizationUnitId: OrganizationUnitId
  departmentCode: string
  assignmentType: "primary" | "concurrent"
  positionTitle: string | null
  managerEmployeeId: EmployeeId | null
}

export type OrgResponsibilityPeriod = LifecyclePeriodBase & {
  employmentId: EmploymentId
  organizationUnitId: OrganizationUnitId
  departmentCode: string
  responsibilityType: "department_manager" | OrgResponsibilityType
  employeeId: EmployeeId
}

export type LifecycleSchedule = {
  employments: ReadonlyArray<EmploymentPeriod>
  statuses: ReadonlyArray<EmployeeStatusPeriod>
  assignments: ReadonlyArray<OrgAssignmentPeriod>
  responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
}

export type EmploymentVersionMutation = {
  periodType: "employment"
  before: EmploymentPeriod | null
  after: EmploymentPeriod
}

export type EmployeeStatusVersionMutation = {
  periodType: "status"
  before: EmployeeStatusPeriod | null
  after: EmployeeStatusPeriod
}

export type OrgAssignmentVersionMutation = {
  periodType: "assignment"
  before: OrgAssignmentPeriod | null
  after: OrgAssignmentPeriod
}

export type OrgResponsibilityVersionMutation = {
  periodType: "responsibility"
  before: OrgResponsibilityPeriod | null
  after: OrgResponsibilityPeriod
}

export type LifecycleVersionMutation =
  | EmploymentVersionMutation
  | EmployeeStatusVersionMutation
  | OrgAssignmentVersionMutation
  | OrgResponsibilityVersionMutation
