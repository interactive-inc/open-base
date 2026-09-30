import { PermissionValue } from "@system/domain/values/iam/permission.value"

/** Company が所有する会社・組織・雇用の権限語彙。 */
export const CompanyPermission = Object.freeze({
  ORG_READ: PermissionValue.known("org:read"),
  ORG_WRITE: PermissionValue.known("org:write"),
  MASTER_ORG_WRITE: PermissionValue.known("master:org:write"),
  MASTER_GRADE_WRITE: PermissionValue.known("master:grade:write"),
  MASTER_POSITION_WRITE: PermissionValue.known("master:position:write"),
  EMPLOYEE_READ: PermissionValue.known("employee:read"),
  EMPLOYEE_ATTRIBUTES_READ: PermissionValue.known("employee:attributes:read"),
  EMPLOYEE_WRITE: PermissionValue.known("employee:write"),
  EMPLOYEE_WRITE_BASIC: PermissionValue.known("employee:write:basic"),
  EMPLOYEE_WRITE_ATTRIBUTES: PermissionValue.known("employee:write:attributes"),
})
