import { ResolveOrganizationAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-organization-authority.adapter"

/** 組織上の権限を解決する公開境界。 */
export function resolveCompanyOrganizationAuthority(
  c: ConstructorParameters<typeof ResolveOrganizationAuthorityAdapter>[0],
  ...input: Parameters<ResolveOrganizationAuthorityAdapter["resolveOrganizationAuthority"]>
): ReturnType<ResolveOrganizationAuthorityAdapter["resolveOrganizationAuthority"]> {
  return new ResolveOrganizationAuthorityAdapter(c).resolveOrganizationAuthority(...input)
}
