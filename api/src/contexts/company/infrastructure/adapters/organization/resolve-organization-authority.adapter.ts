import { type EmployeeManagementAuthority as OrganizationAuthority } from "@/contexts/company/domain/definitions/employee-management-authority.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { resolveEmployeeManagementAuthority } from "@/contexts/company/domain/policies/resolve-employee-management-authority.policy"
import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"

/**
 * 組織図上で actor が target に対して持つ管理関係を解決する。
 * IAM permission は「操作能力」、本関数は「対象範囲」だけを扱う。
 */
async function resolveOrganizationAuthority(
  c: CompanyContext,
  actorEmployeeId: EmployeeId,
  targetEmployeeId: EmployeeId,
): Promise<OrganizationAuthority | Error> {
  const snapshot = await new ReadCanonicalOrganizationStateAdapter(
    c,
  ).readCanonicalOrganizationState()
  if (snapshot instanceof Error) return snapshot

  return resolveEmployeeManagementAuthority({
    states: snapshot.employees,
    managementRelations: snapshot.managementRelations,
    actorEmployeeId,
    targetEmployeeId,
  })
}
type Context = CompanyContext

export class ResolveOrganizationAuthorityAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolveOrganizationAuthority(
    actorEmployeeId: EmployeeId,
    targetEmployeeId: EmployeeId,
  ): Promise<OrganizationAuthority | Error> {
    return resolveOrganizationAuthority(this.c, actorEmployeeId, targetEmployeeId)
  }
}
