import { readCompanyCanonicalOrganizationState } from "@/contexts/company/interface/operations/read-company-canonical-organization-state"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"

export async function loadCurrentEmployeeDepartmentNames(
  c: Context,
  employeeIds: ReadonlyArray<EmployeeId>,
): Promise<ReadonlyMap<EmployeeId, string | null> | Error> {
  const snapshot = await readCompanyCanonicalOrganizationState(c)
  if (snapshot instanceof Error) return snapshot
  const requested = new Set(employeeIds)
  const unitNameById = new Map(
    snapshot.organization.units.map(
      (unit) => [unit.organizationUnitId, unit.officialName] as const,
    ),
  )
  const names = new Map<EmployeeId, string | null>()
  for (const employee of snapshot.employees) {
    if (!requested.has(employee.employeeId)) continue
    names.set(
      employee.employeeId,
      employee.primaryAssignment === null
        ? null
        : (unitNameById.get(employee.primaryAssignment.organizationUnitId) ?? null),
    )
  }
  return names
}
