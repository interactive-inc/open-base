import type { OrgAssignmentPeriod } from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"

type Props = {
  assignment: OrgAssignmentPeriod
  startsOn: string
  endsOn: string | null
}

/** 所属を維持したまま、指定した雇用の空白に限って上長の指定を外す。 */
export function splitAssignmentManagerPeriod(props: Props): ReadonlyArray<OrgAssignmentPeriod> {
  const assignment = props.assignment
  const startsOn = assignment.startsOn > props.startsOn ? assignment.startsOn : props.startsOn
  const endsOn =
    props.endsOn === null || (assignment.endsOn !== null && assignment.endsOn < props.endsOn)
      ? assignment.endsOn
      : props.endsOn

  if (endsOn !== null && startsOn >= endsOn) return []

  const periods: OrgAssignmentPeriod[] = []
  if (assignment.startsOn < startsOn) periods.push({ ...assignment, endsOn: startsOn })
  periods.push({ ...assignment, startsOn, endsOn, managerEmployeeId: null })
  if (endsOn !== null && (assignment.endsOn === null || endsOn < assignment.endsOn))
    periods.push({ ...assignment, startsOn: endsOn })
  return periods
}
