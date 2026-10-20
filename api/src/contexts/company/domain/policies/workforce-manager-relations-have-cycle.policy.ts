import { hasManagementCycle } from "@/contexts/company/domain/definitions/has-management-cycle.definition"
import type { WorkforceManagerRelation } from "@/contexts/company/domain/definitions/workforce-manager-relation.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

/** 上長関係を従業員ごとにまとめ、経路を列挙しない共通の検査で循環を判定する。 */
export function workforceManagerRelationsHaveCycle(
  relations: ReadonlyArray<WorkforceManagerRelation>,
): boolean {
  const managersByEmployee = new Map<EmployeeId, EmployeeId[]>()
  for (const relation of relations) {
    const managers = managersByEmployee.get(relation.employeeId) ?? []
    managers.push(relation.managerEmployeeId)
    managersByEmployee.set(relation.employeeId, managers)
  }
  return hasManagementCycle(managersByEmployee)
}
