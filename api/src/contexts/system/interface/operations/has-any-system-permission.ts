import { PermissionValue } from "@system/domain/values/iam/permission.value"

export function hasAnySystemPermission(...input: Parameters<typeof PermissionValue.hasAny>) {
  return PermissionValue.hasAny(...input)
}
