import { resolveLifecycleAssignment } from "@/contexts/company/lib/workforce/resolve-lifecycle-assignment"
import { toLifecycleStatus } from "@/contexts/company/lib/workforce/to-lifecycle-status"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import type {
  EmployeeLifecycleState,
  LifecycleAssignmentState,
} from "@/contexts/company/lib/workforce/employee-lifecycle-state"

type Props = Readonly<{
  workforce: WorkforceStateAt
  projection: EmployeeLifecycleState
}>

/** 共通Workforceの判断へ、既存APIだけが必要とする表示値とrevisionを合成する。 */
export function toEmployeeLifecycleState(props: Props): EmployeeLifecycleState | Error {
  const employmentPeriodId = props.workforce.employmentId
  if (props.projection.employmentPeriodId !== employmentPeriodId) {
    return new Error("workforce employment differs from the lifecycle projection")
  }

  const projectionAssignments = [
    ...(props.projection.primaryAssignment === null ? [] : [props.projection.primaryAssignment]),
    ...props.projection.concurrentAssignments,
  ]
  const concurrentAssignments: LifecycleAssignmentState[] = []
  const primaryAssignment =
    props.workforce.primaryAssignment === null
      ? null
      : resolveLifecycleAssignment({
          assignment: props.workforce.primaryAssignment,
          projections: projectionAssignments,
        })

  if (primaryAssignment instanceof Error) return primaryAssignment

  for (const assignment of props.workforce.concurrentAssignments) {
    const resolved = resolveLifecycleAssignment({ assignment, projections: projectionAssignments })

    if (resolved instanceof Error) return resolved
    concurrentAssignments.push(resolved)
  }

  if (projectionAssignments.length !== concurrentAssignments.length + (primaryAssignment ? 1 : 0)) {
    return new Error("lifecycle projection contains an assignment absent from workforce state")
  }

  const responsibilityDepartmentCodes: string[] = []
  const matchedResponsibilityPeriods = new Set<string>()

  for (const responsibility of props.workforce.responsibilities) {
    // 旧wireのdepartment codesは部門管理責務だけを表す。
    if (responsibility.responsibilityType !== "MANAGER") continue
    const projection = props.projection.responsibilities.find(
      (candidate) => candidate.periodId === responsibility.periodId,
    )
    if (
      projection === undefined ||
      projection.employmentPeriodId !== responsibility.employmentId ||
      projection.organizationUnitId !== responsibility.organizationUnitId ||
      projection.startsOn !== responsibility.startsOn ||
      projection.endsOn !== responsibility.endsOn
    ) {
      return new Error("workforce responsibility differs from the lifecycle projection")
    }
    matchedResponsibilityPeriods.add(projection.periodId)
    responsibilityDepartmentCodes.push(projection.departmentCode)
  }

  responsibilityDepartmentCodes.sort()
  const projectedResponsibilityDepartmentCodes = [
    ...props.projection.responsibilityDepartmentCodes,
  ].sort()
  if (
    responsibilityDepartmentCodes.length !== projectedResponsibilityDepartmentCodes.length ||
    matchedResponsibilityPeriods.size !== props.projection.responsibilities.length ||
    responsibilityDepartmentCodes.some(
      (departmentCode, index) => departmentCode !== projectedResponsibilityDepartmentCodes[index],
    )
  ) {
    return new Error("workforce responsibilities differ from the lifecycle projection")
  }

  return {
    ...props.projection,
    asOf: props.workforce.asOf,
    status: toLifecycleStatus(props.workforce.status),
    employmentPeriodId,
    primaryAssignment,
    concurrentAssignments,
    responsibilities: props.projection.responsibilities,
    responsibilityDepartmentCodes,
  }
}
