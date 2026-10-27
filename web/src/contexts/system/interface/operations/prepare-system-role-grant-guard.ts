import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { iamRoleIdSchema } from "@system/domain/schemas/iam/iam-role.schema"
import { SystemRoleGrantGuardAdapter } from "@system/infrastructure/adapters/iam/system-role-grant-guard.adapter"
import type { BatchItem } from "drizzle-orm/batch"

/** 他 context の D1 batch で Account・role・禁止権限を保存直前に再検査する。 */
export function prepareSystemRoleGrantGuard(
  input: Readonly<{
    database: D1Database
    accountId: string
    roleId: string
    resourceType: string
    forbiddenPermissionKeys: ReadonlyArray<string>
  }>,
): BatchItem<"sqlite"> | Error {
  if (
    !zAccountId.safeParse(input.accountId).success ||
    !iamRoleIdSchema.safeParse(input.roleId).success ||
    input.resourceType.length < 3 ||
    input.resourceType.length > 100 ||
    input.forbiddenPermissionKeys.length > 100 ||
    input.forbiddenPermissionKeys.some((key) => key.length < 3 || key.length > 100)
  ) {
    return new Error("Invalid System role grant guard")
  }
  return new SystemRoleGrantGuardAdapter(input).prepare()
}
