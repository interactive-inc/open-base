import { PermissionValue } from "@system/domain/values/iam/permission.value"
import { z } from "zod"

export function readSystemPermissionInputSchema() {
  return z.instanceof(PermissionValue)
}
