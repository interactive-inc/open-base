/** 全ての上長関係を検査する。経路の列挙や再帰を使わず、分岐の多い組織も扱う。 */
export function hasManagementCycle<Employee extends string>(
  managersByEmployee: ReadonlyMap<Employee, ReadonlyArray<Employee>>,
): boolean {
  const incoming = new Map<Employee, number>()
  for (const employeeId of managersByEmployee.keys()) {
    incoming.set(employeeId, incoming.get(employeeId) ?? 0)
    for (const manager of managersByEmployee.get(employeeId) ?? []) {
      incoming.set(manager, (incoming.get(manager) ?? 0) + 1)
    }
  }

  const pending = [...incoming.keys()].filter((employeeId) => incoming.get(employeeId) === 0)
  for (const employeeId of pending) {
    for (const manager of managersByEmployee.get(employeeId) ?? []) {
      const remaining = (incoming.get(manager) ?? 0) - 1
      incoming.set(manager, remaining)
      if (remaining === 0) pending.push(manager)
    }
  }

  return pending.length !== incoming.size
}
