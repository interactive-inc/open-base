import type { OrgAssignmentPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type { LifecycleAssignmentState } from "@/contexts/company/lib/workforce/employee-lifecycle-state"

type Props = Readonly<{
  assignment: OrgAssignmentPeriod
  projections: ReadonlyArray<LifecycleAssignmentState>
}>

/** 共通assignmentに対応する表示projectionを一意に解決し、意味のdriftを拒否する。 */
export function resolveLifecycleAssignment(props: Props): LifecycleAssignmentState | Error {
  const projection = props.projections.find(
    (candidate) => candidate.periodId === props.assignment.periodId,
  )
  const managerEmployeeId = props.assignment.managerEmployeeId
  const hasSameManager =
    managerEmployeeId === null
      ? projection?.managerEmployeeId === null
      : managerEmployeeId === projection?.managerEmployeeId

  if (
    projection === undefined ||
    projection.employmentPeriodId !== props.assignment.employmentId ||
    projection.organizationUnitId !== props.assignment.organizationUnitId ||
    projection.assignmentType !== props.assignment.assignmentType.toLowerCase() ||
    projection.positionTitle !== props.assignment.positionTitle ||
    projection.startsOn !== props.assignment.startsOn ||
    projection.endsOn !== props.assignment.endsOn ||
    !hasSameManager
  ) {
    return new Error("workforce assignment differs from the lifecycle projection")
  }

  return projection
}
