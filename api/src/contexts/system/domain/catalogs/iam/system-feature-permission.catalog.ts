import { PermissionValue } from "@system/domain/values/iam/permission.value"

/** Company roleから利用できる、System IAM最小核以外の機能権限。 */
export const SystemFeaturePermission = Object.freeze({
  ACCOUNT_MANAGE: PermissionValue.known("account:manage"),
  RECORD_PRESERVE: PermissionValue.known("system:record:preserve"),
  RECORD_READ: PermissionValue.known("system:record:read"),
  RECORD_EXPORT: PermissionValue.known("system:record:export"),
  AUDIT_READ: PermissionValue.known("audit:read"),
  AUDIT_EXPORT: PermissionValue.known("audit:export"),
  NOTIFICATION_SEND: PermissionValue.known("notification:send"),
  PROCEDURE_READ: PermissionValue.known("system:procedure:read"),
  PROCEDURE_READ_ALL: PermissionValue.known("system:procedure:read:all"),
  WORK_READ: PermissionValue.known("system:work:read"),
  WORK_CREATE: PermissionValue.known("system:work:create"),
  WORK_PERFORM: PermissionValue.known("system:work:perform"),
  WORK_REVIEW: PermissionValue.known("system:work:review"),
  WORK_MANAGE: PermissionValue.known("system:work:manage"),
  BATCH_VIEW: PermissionValue.known("batch:view"),
  PERSONAL_DATA_ERASE: PermissionValue.known("personal_data:erase"),
})
