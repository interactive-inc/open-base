import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

/** canonical Assignmentから指定時点の一意な直属上長を解決する。 */
async function resolveDirectManagerId(
  c: CompanyContext,
  targetEmployeeId: EmployeeId,
  asOf: string,
): Promise<EmployeeId | null | Error> {
  const snapshot = await new ReadCanonicalOrganizationStateAdapter(
    c,
  ).readCanonicalOrganizationState(restoreCalendarDate(asOf))
  if (snapshot instanceof Error) return snapshot
  const target = snapshot.employees.find((employee) => employee.employeeId === targetEmployeeId)
  const managerEmployeeId = target?.primaryAssignment?.managerEmployeeId ?? null
  return managerEmployeeId
}
type Context = CompanyContext

export class ResolveDirectManagerIdAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolveDirectManagerId(
    targetEmployeeId: EmployeeId,
    asOf: string,
  ): Promise<EmployeeId | null | Error> {
    return resolveDirectManagerId(this.c, targetEmployeeId, asOf)
  }
}
