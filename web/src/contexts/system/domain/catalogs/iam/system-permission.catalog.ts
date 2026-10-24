import { PermissionValue } from "@system/domain/values/iam/permission.value"

/** すべての実装が持つSystem IAM最小核。追加機能の権限は利用側contextが合成する。 */
export const SystemPermission = Object.freeze({
  SYSTEM_ADMIN: PermissionValue.known("system:admin"),
  IAM_READ: PermissionValue.known("iam:read"),
  IAM_WRITE: PermissionValue.known("iam:write"),
})
