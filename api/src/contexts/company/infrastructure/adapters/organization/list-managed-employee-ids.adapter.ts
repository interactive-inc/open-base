import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { listManagedWorkforceEmployeeIds } from "@/contexts/company/domain/policies/list-managed-workforce-employee-ids.policy"
import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

/** actor が管理できる社員IDを返す。受信箱の絞り込みに使う。 */
async function listManagedEmployeeIds(
  c: CompanyContext,
  actorEmployeeId: EmployeeId,
  asOf?: CalendarDate,
): Promise<ReadonlyArray<EmployeeId> | Error> {
  const snapshot = await new ReadCanonicalOrganizationStateAdapter(
    c,
  ).readCanonicalOrganizationState(asOf)
  if (snapshot instanceof Error) return snapshot

  const employeeIds = listManagedWorkforceEmployeeIds({
    states: snapshot.employees,
    managementRelations: snapshot.managementRelations,
    actorEmployeeId,
  })
  return employeeIds.toSorted((left, right) => left.localeCompare(right))
}
type Context = CompanyContext

export class ListManagedEmployeeIdsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async listManagedEmployeeIds(
    actorEmployeeId: EmployeeId,
    asOf?: CalendarDate,
  ): Promise<ReadonlyArray<EmployeeId> | Error> {
    return listManagedEmployeeIds(this.c, actorEmployeeId, asOf)
  }
}
