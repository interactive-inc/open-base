import { CompanyPermission } from "@/contexts/company/domain/catalogs/iam/company-permission.catalog"
import { PermissionValue } from "@/contexts/system/domain/values/iam/permission.value"
import { SystemPermission } from "@/contexts/system/domain/catalogs/iam/system-permission.catalog"

/** SystemとCompanyの権限を横断し、機微な労務属性を書き込めるか判定する。 */
export function canWriteEmployeeAttributes(permissions: ReadonlySet<string>): boolean {
  return PermissionValue.hasAny(
    permissions,
    SystemPermission.SYSTEM_ADMIN,
    CompanyPermission.EMPLOYEE_WRITE,
    CompanyPermission.EMPLOYEE_WRITE_ATTRIBUTES,
  )
}
