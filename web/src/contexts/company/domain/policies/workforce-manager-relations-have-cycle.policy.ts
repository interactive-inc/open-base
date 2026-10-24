import type { WorkforceManagerRelation } from "@/contexts/company/domain/definitions/workforce-manager-relation.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export function workforceManagerRelationsHaveCycle(
  relations: ReadonlyArray<WorkforceManagerRelation>,
): boolean {
  const graph = new Map<EmployeeId, Set<EmployeeId>>()
  for (const relation of relations) {
    const managers = graph.get(relation.employeeId) ?? new Set<EmployeeId>()
    managers.add(relation.managerEmployeeId)
    graph.set(relation.employeeId, managers)
  }

  for (const employeeId of graph.keys()) {
    const pending = [{ employeeId, path: new Set<EmployeeId>() }]
    while (pending.length > 0) {
      const current = pending.pop()
      if (current === undefined) break
      if (current.path.has(current.employeeId)) return true
      const path = new Set(current.path).add(current.employeeId)
      for (const managerEmployeeId of graph.get(current.employeeId) ?? []) {
        pending.push({ employeeId: managerEmployeeId, path })
      }
    }
  }
  return false
}
