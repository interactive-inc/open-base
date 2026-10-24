import { CurrentOrganizationReadModelAdapter } from "@/contexts/company/infrastructure/adapters/organization/current-organization-read-model.adapter"

/** 現在の組織の読取モデルを読む公開境界。 */
export function loadCompanyCurrentOrganization(
  c: ConstructorParameters<typeof CurrentOrganizationReadModelAdapter>[0],
  ...input: Parameters<CurrentOrganizationReadModelAdapter["loadCurrentOrganization"]>
): ReturnType<CurrentOrganizationReadModelAdapter["loadCurrentOrganization"]> {
  return new CurrentOrganizationReadModelAdapter(c).loadCurrentOrganization(...input)
}
