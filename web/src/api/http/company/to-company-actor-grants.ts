import type { CompanyCapability } from "@/contexts/company/domain/values/company-actor.value"
import type { CompanyPermissionKey } from "@/contexts/company/domain/catalogs/iam/company-permission-key.catalog"

export type CompanyActorGrants = Readonly<{
  capabilities: ReadonlyArray<CompanyCapability>
  permissions: ReadonlyArray<CompanyPermissionKey>
}>

/**
 * System permissionをCompanyの資格へ写像する。
 * 従業員の登録・更新権限から会社全体の変更資格（company:write）や
 * 人事発令の確定権限（employee:write）を導出しない。
 */
export function toCompanyActorGrants(
  hasPermission: (permission: string) => boolean,
): CompanyActorGrants {
  const isAdmin = hasPermission("system:admin")
  const managesOrganization = hasPermission("org:manage")
  const capabilities: CompanyCapability[] = []
  const permissions: CompanyPermissionKey[] = []

  if (isAdmin || hasPermission("employee:read") || managesOrganization) {
    capabilities.push("company:read")
  }
  if (isAdmin || managesOrganization) {
    capabilities.push("company:write")
  } else if (hasPermission("employee:update")) {
    capabilities.push("company:workforce:update")
  }
  if (isAdmin) capabilities.push("company:admin")

  if (isAdmin || managesOrganization) {
    permissions.push("org:read", "org:write", "master:org:write")
  } else if (hasPermission("employee:read")) {
    permissions.push("org:read")
  }
  if (isAdmin || hasPermission("employee:read")) permissions.push("employee:read")
  if (isAdmin || hasPermission("employee:attributes:read")) {
    permissions.push("employee:attributes:read")
  }
  // employee:writeは人事発令の確定（employee:lifecycle:apply）として扱われる。
  if (isAdmin || hasPermission("employee:lifecycle:apply")) permissions.push("employee:write")
  if (isAdmin || hasPermission("employee:update")) permissions.push("employee:write:basic")
  if (isAdmin || hasPermission("employee_event:manage")) {
    permissions.push("employee:write:attributes")
  }
  // アカウントと従業員の紐付けはアカウント管理の資格として扱い、組織管理からは導出しない。
  if (isAdmin || hasPermission("account:manage")) permissions.push("account_link:write")
  if (hasPermission("grade:manage")) permissions.push("master:grade:write")
  if (hasPermission("position:manage")) permissions.push("master:position:write")

  return { capabilities, permissions }
}
