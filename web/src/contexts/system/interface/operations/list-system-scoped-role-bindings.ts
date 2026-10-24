import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { ListSystemScopedRoleBindingsAdapter } from "@system/infrastructure/adapters/iam/list-system-scoped-role-bindings.adapter"
import type { SystemScopedRoleBinding } from "@system/domain/definitions/system-iam-read-models.definition"

/** 他contextにopaque resource上の有効なbindingと権限を公開する。 */
export async function listSystemScopedRoleBindings(
  input: Readonly<{
    database: D1Database
    resourceType: string
    resourceId: string
    accountId?: string
    at: Date
  }>,
): Promise<ReadonlyArray<SystemScopedRoleBinding> | Error> {
  const accountId =
    input.accountId === undefined ? undefined : zAccountId.safeParse(input.accountId)
  if (
    (accountId !== undefined && !accountId.success) ||
    !/^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/.test(input.resourceType) ||
    input.resourceType.length > 100 ||
    input.resourceId.length < 1 ||
    input.resourceId.length > 255 ||
    !Number.isSafeInteger(input.at.getTime())
  )
    return new Error("invalid System scoped role query")

  return new ListSystemScopedRoleBindingsAdapter(input.database).list({
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    accountId: accountId?.data,
    at: input.at,
  })
}
