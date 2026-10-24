import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

/** canonical AssignmentとMANAGER Responsibilityから指定時点の一意な部門長を解決する。 */
async function resolveDepartmentManagerId(
  c: CompanyContext,
  targetEmployeeId: EmployeeId,
  asOf: string,
): Promise<EmployeeId | null | Error> {
  const snapshot = await new ReadCanonicalOrganizationStateAdapter(
    c,
  ).readCanonicalOrganizationState(restoreCalendarDate(asOf))
  if (snapshot instanceof Error) return snapshot
  const target = snapshot.employees.find((employee) => employee.employeeId === targetEmployeeId)
  const organizationUnitId = target?.primaryAssignment?.organizationUnitId
  if (organizationUnitId === undefined) return null
  const managers = snapshot.employees.flatMap((employee) =>
    employee.responsibilities.some(
      (responsibility) =>
        responsibility.responsibilityType === "MANAGER" &&
        responsibility.organizationUnitId === organizationUnitId,
    )
      ? [employee.employeeId]
      : [],
  )
  if (managers.length > 1) return new Error("organization manager is ambiguous")
  return managers[0] ?? null
}
type Context = CompanyContext

export class ResolveDepartmentManagerIdAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolveDepartmentManagerId(
    targetEmployeeId: EmployeeId,
    asOf: string,
  ): Promise<EmployeeId | null | Error> {
    return resolveDepartmentManagerId(this.c, targetEmployeeId, asOf)
  }
}
