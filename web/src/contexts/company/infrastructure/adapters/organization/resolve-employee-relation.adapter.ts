import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { EmployeeRelation } from "@/contexts/company/domain/definitions/employee-relation.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { resolveWorkforceEmployeeRelation } from "@/contexts/company/domain/policies/resolve-workforce-employee-relation.policy"
import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"
type Context = CompanyContext

/** canonical Company snapshotから、閲覧者と対象者の組織上の関係を解決する。 */
export class ResolveEmployeeRelationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolveEmployeeRelation(props: {
    viewerEmployeeId: EmployeeId
    targetEmployeeId: EmployeeId
  }): Promise<EmployeeRelation | Error> {
    const snapshot = await new ReadCanonicalOrganizationStateAdapter(
      this.c,
    ).readCanonicalOrganizationState()
    if (snapshot instanceof Error) return snapshot

    return resolveWorkforceEmployeeRelation({
      states: snapshot.employees,
      managementRelations: snapshot.managementRelations,
      viewerEmployeeId: props.viewerEmployeeId,
      targetEmployeeId: props.targetEmployeeId,
    })
  }
}
