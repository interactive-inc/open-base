import type { CompanyPermissionKey } from "@/contexts/company/domain/catalogs/iam/company-permission-key.catalog"
import type { CompanyResourceType } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"

/**
 * 組織変更で資源種別ごとに要求するCompany権限。いずれか一つを持てば変更できる。
 * 写像の無い種別は専用の書込経路だけで扱い、組織変更では拒否する。
 */
const organizationChangePermissions: Readonly<
  Partial<Record<CompanyResourceType, ReadonlyArray<CompanyPermissionKey>>>
> = Object.freeze({
  "legal-entity": ["org:write"],
  "company-profile": ["org:write"],
  site: ["org:write"],
  workplace: ["org:write"],
  "organization-unit": ["org:write"],
  assignment: ["org:write"],
  "reporting-relation": ["org:write"],
  job: ["org:write"],
  "organizational-office": ["org:write"],
  "office-assignment": ["org:write"],
  responsibility: ["org:write"],
  "authority-scope": ["org:write"],
  "responsibility-assignment": ["org:write"],
  "collective-body": ["org:write"],
  "collective-body-membership": ["org:write"],
  "organizational-authority": ["org:write"],
  person: ["employee:write"],
  employee: ["employee:write"],
  employment: ["employee:write"],
  grade: ["master:grade:write"],
  position: ["master:position:write"],
  "grade-assignment": ["employee:write", "employee:write:attributes"],
})

/**
 * 会社全体の変更資格に加え、変更するすべての資源種別の個別権限を要求する。
 * 種別が空、または写像の無い種別を含む場合は拒否する。
 */
export function canApplyOrganizationChange(
  actor: CompanyActorValue,
  types: ReadonlyArray<CompanyResourceType>,
): boolean {
  if (!actor.hasCapability("company:write") || types.length === 0) return false
  return types.every((type) => {
    const permissions = organizationChangePermissions[type]
    if (permissions === undefined) return false
    return permissions.some((permission) => actor.hasPermission(permission))
  })
}
