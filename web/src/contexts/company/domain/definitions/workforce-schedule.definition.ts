import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { EmploymentStatus } from "@/contexts/company/domain/definitions/employment-status.definition"
import type { OrgAssignmentType } from "@/contexts/company/domain/definitions/org-assignment-type.definition"
import type { OrgResponsibilityType } from "@/contexts/company/domain/definitions/org-responsibility-type.definition"
import type {
  EmployeeId,
  EmploymentId,
  OrganizationUnitId,
  PersonnelActionId,
  SystemAccountId,
  WorkforcePeriodId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"

/** revisionごとに追記される半開有効期間 [startsOn, endsOn)。 */
export type WorkforcePeriodVersion = Readonly<{
  periodId: WorkforcePeriodId
  revision: number
  startsOn: CalendarDate
  endsOn: CalendarDate | null
  isVoid: boolean
  recordedByActionId: PersonnelActionId
  recordedAt: number
}>

export type Employee = Readonly<{
  id: EmployeeId
  officialName: string
  employeeCode: string | null
  email: string | null
  phone: string | null
}>

export type EmploymentPeriod = WorkforcePeriodVersion &
  Readonly<{
    employmentId: EmploymentId
    employeeId: EmployeeId
  }>

export type EmploymentStatusPeriod = WorkforcePeriodVersion &
  Readonly<{
    employmentId: EmploymentId
    employeeId: EmployeeId
    status: EmploymentStatus
  }>

export type OrgAssignmentPeriod = WorkforcePeriodVersion &
  Readonly<{
    employmentId: EmploymentId
    employeeId: EmployeeId
    organizationUnitId: OrganizationUnitId
    assignmentType: OrgAssignmentType
    positionTitle: string | null
    managerEmployeeId: EmployeeId | null
  }>

export type OrgResponsibilityPeriod = WorkforcePeriodVersion &
  Readonly<{
    employmentId: EmploymentId
    employeeId: EmployeeId
    organizationUnitId: OrganizationUnitId
    responsibilityType: OrgResponsibilityType
  }>

/** System Accountとの対応はCompanyが所有し、System側からEmployeeを参照しない。 */
export type AccountEmployeeLink = Readonly<{
  accountId: SystemAccountId
  employeeId: EmployeeId
}>

/** 観測開始時点で明示され、雇用期間を推測せず保持する初期Workforce状態。 */
export type WorkforceBaselineState = Readonly<{
  asOf: CalendarDate
  status: "PRE_HIRE" | "TERMINATED"
}>

/** Employee profileやSystem Accountに依存しない、雇用ライフサイクルの正規化済みschedule。 */
export type WorkforceLifecycleSchedule = Readonly<{
  employeeId: EmployeeId
  baselineState?: WorkforceBaselineState
  employments: ReadonlyArray<EmploymentPeriod>
  statuses: ReadonlyArray<EmploymentStatusPeriod>
  assignments: ReadonlyArray<OrgAssignmentPeriod>
  responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
}>

/** 1 Employeeの最新revisionだけを並べた正規化済みschedule。 */
export type WorkforceSchedule = Readonly<{
  employee: Employee
  baselineState?: WorkforceBaselineState
  employments: ReadonlyArray<EmploymentPeriod>
  statuses: ReadonlyArray<EmploymentStatusPeriod>
  assignments: ReadonlyArray<OrgAssignmentPeriod>
  responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
  accountLink: AccountEmployeeLink | null
}>
