import { readCompanyCanonicalOrganizationState } from "@/contexts/company/interface/operations/read-company-canonical-organization-state"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"
import { listReportWorkforceEmployeeIds } from "@/contexts/company/domain/policies/list-report-workforce-employee-ids.policy"

export type Props = {
  c: Context
  viewerEmployeeId: EmployeeId
}

/**
 * viewer の配下(再帰)にあたる従業員 id をcanonical Company snapshotから解決する。
 * viewer 自身は含めない。
 */
export async function listReportEmployeeIds(
  props: Props,
): Promise<ReadonlyArray<EmployeeId> | Error> {
  const snapshot = await readCompanyCanonicalOrganizationState(props.c)
  if (snapshot instanceof Error) return snapshot

  return listReportWorkforceEmployeeIds({
    states: snapshot.employees,
    managementRelations: snapshot.managementRelations,
    actorEmployeeId: props.viewerEmployeeId,
  })
}
