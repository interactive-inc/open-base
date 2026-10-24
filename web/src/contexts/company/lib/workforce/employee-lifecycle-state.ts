import type { LifecycleEmployeeStatus } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import type {
  EmployeeId,
  EmploymentId,
  OrganizationUnitId,
  WorkforcePeriodId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"

export type LifecycleAssignmentState = {
  periodId: WorkforcePeriodId
  employmentPeriodId: EmploymentId
  organizationUnitId: OrganizationUnitId
  departmentCode: string
  departmentName: string
  assignmentType: "primary" | "concurrent"
  positionTitle: string | null
  managerEmployeeId: EmployeeId | null
  managerEmployeeCode: string | null
  startsOn: string
  endsOn: string | null
}

export type LifecycleResponsibilityState = {
  periodId: WorkforcePeriodId
  employmentPeriodId: EmploymentId
  organizationUnitId: OrganizationUnitId
  departmentCode: string
  startsOn: string
  endsOn: string | null
}

export type EmployeeLifecycleState = {
  employeeId: EmployeeId
  employeeCode: string
  asOf: string
  status: LifecycleEmployeeStatus
  employmentPeriodId: EmploymentId | null
  primaryAssignment: LifecycleAssignmentState | null
  concurrentAssignments: ReadonlyArray<LifecycleAssignmentState>
  responsibilities: ReadonlyArray<LifecycleResponsibilityState>
  responsibilityDepartmentCodes: ReadonlyArray<string>
  employeeRevision: number
  organizationRevision: number
}
