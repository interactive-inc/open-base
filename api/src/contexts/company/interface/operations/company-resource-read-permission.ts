import type { CompanyResourceType } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"
import type { CompanyPermissionKey } from "@/contexts/company/domain/catalogs/iam/company-permission-key.catalog"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"

/** 資源の公開属性と履歴・変更理由に必要な、会社共通の閲覧資格。 */
function companyResourceReadPermission(type: CompanyResourceType): CompanyPermissionKey | null {
  if (type === "grade-assignment") return "employee:attributes:read"
  if (
    type === "person" ||
    type === "employee" ||
    type === "employment" ||
    type === "account-employee-link" ||
    type === "personnel-action"
  ) {
    return "employee:read"
  }
  return null
}

export function canReadCompanyResource(
  actor: CompanyActorValue,
  type: CompanyResourceType,
): boolean {
  if (!actor.hasCapability("company:read")) return false
  const permission = companyResourceReadPermission(type)
  return permission === null || actor.hasPermission(permission)
}
