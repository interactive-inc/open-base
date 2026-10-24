type LifecycleAssignment = Readonly<{
  periodId: string
  employmentPeriodId: string
  departmentCode: string
  departmentName: string
  assignmentType: "primary" | "concurrent"
  positionTitle: string | null
  managerEmployeeCode: string | null
  startsOn: string
  endsOn: string | null
}>

/** 現在の配属状態をCompany HTTP契約へ投影する。 */
export function toLifecycleAssignmentResponse(assignment: LifecycleAssignment) {
  return {
    period_id: assignment.periodId,
    employment_period_id: assignment.employmentPeriodId,
    department_code: assignment.departmentCode,
    department_name: assignment.departmentName,
    assignment_type: assignment.assignmentType,
    position_title: assignment.positionTitle,
    manager_employee_code: assignment.managerEmployeeCode,
    starts_on: assignment.startsOn,
    ends_on: assignment.endsOn,
  }
}
