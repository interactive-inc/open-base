import { PermissionValue } from "@system/domain/values/iam/permission.value"

export function parseSystemPermission(key: string) {
  return PermissionValue.from(key)
}
