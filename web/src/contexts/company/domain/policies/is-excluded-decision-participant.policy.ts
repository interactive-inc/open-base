import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

/**
 * 判断から除外された従業員が、判断者本人または代理の元になった判断者として関与するかを返す。
 * 委任で代理するときも、操作した本人と代理された判断者の両方を除外対象と照合する。
 */
export function isExcludedDecisionParticipant(props: {
  actorEmployeeId: EmployeeId
  representedEmployeeId: EmployeeId
  excludedEmployeeIds: ReadonlySet<EmployeeId>
}): boolean {
  return (
    props.excludedEmployeeIds.has(props.actorEmployeeId) ||
    props.excludedEmployeeIds.has(props.representedEmployeeId)
  )
}
