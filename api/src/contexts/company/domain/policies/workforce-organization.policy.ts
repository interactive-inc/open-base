import type { OrganizationStructureValue } from "@/contexts/company/domain/values/organization-structure.value"
import type { WorkforceScheduleEntity } from "@/contexts/company/domain/entities/workforce-schedule.entity"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/definitions/workforce-invariant.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { validateWorkforceOrganizationUnit } from "@/contexts/company/domain/policies/workforce-organization-unit.policy"

function violation(
  code: WorkforceInvariantViolation["code"],
  message: string,
): WorkforceInvariantViolation {
  return Object.freeze({ code, message })
}

function hasManagementCycle(
  relations: ReadonlyArray<{
    employeeId: EmployeeId
    managerEmployeeId: EmployeeId
  }>,
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

/**
 * 複数Employee scheduleと組織構造を横断しないと判定できない整合性だけを検証する。
 */
export function validateWorkforceOrganization(props: {
  schedules: ReadonlyArray<WorkforceScheduleEntity>
  organization: OrganizationStructureValue
}): WorkforceInvariantViolation | null {
  const employeeIds = new Set<EmployeeId>()
  const accountIds = new Set<string>()
  for (const schedule of props.schedules) {
    if (employeeIds.has(schedule.employeeId)) {
      return violation("invalid_employee", "employee appears more than once")
    }
    employeeIds.add(schedule.employeeId)

    if (schedule.accountLink !== null) {
      if (accountIds.has(schedule.accountLink.accountId)) {
        return violation("duplicate_account_link", "system account is linked more than once")
      }
      accountIds.add(schedule.accountLink.accountId)
    }

    const organizationError = validateWorkforceOrganizationUnit(schedule, props.organization)
    if (organizationError !== null) return organizationError
  }

  const schedulesByEmployee = new Map(
    props.schedules.map((schedule) => [schedule.employeeId, schedule]),
  )
  const boundaryDates = [
    ...new Set(props.schedules.flatMap((schedule) => schedule.boundaryDates)),
  ].sort()
  for (const date of boundaryDates) {
    const relations = props.schedules.flatMap((schedule) =>
      schedule.assignmentsAt(date).flatMap((assignment) =>
        assignment.managerEmployeeId === null
          ? []
          : [
              {
                employeeId: schedule.employeeId,
                managerEmployeeId: assignment.managerEmployeeId,
              },
            ],
      ),
    )
    for (const relation of relations) {
      const manager = schedulesByEmployee.get(relation.managerEmployeeId)
      if (manager === undefined || !manager.isActiveAt(date)) {
        return violation("manager_not_active", "manager is not active on assignment date")
      }
    }
    if (hasManagementCycle(relations)) {
      return violation("manager_cycle", "management chain contains a cycle")
    }
  }

  return null
}
