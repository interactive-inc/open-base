import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { ListSystemPermissionHolderAccountsAdapter } from "@system/infrastructure/adapters/iam/list-system-permission-holder-accounts.adapter"

const RESOURCE_TYPE_PATTERN = /^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/

/**
 * permissionを有効なrole割当で保持するactive AccountのIDを昇順で返す。
 * global割当は常に含め、resourceを渡したときはそのresourceへの割当も含める。
 */
export async function listSystemPermissionHolderAccounts(
  input: Readonly<{
    database: D1Database
    permissionKey: string
    resource: Readonly<{ type: string; id: string }> | null
  }>,
): Promise<ReadonlyArray<AccountId> | Error> {
  if (input.permissionKey.length < 3 || input.permissionKey.length > 100)
    return new Error("invalid System permission key")
  if (
    input.resource !== null &&
    (input.resource.type.length > 100 ||
      !RESOURCE_TYPE_PATTERN.test(input.resource.type) ||
      input.resource.id.length === 0 ||
      input.resource.id.length > 255)
  )
    return new Error("invalid System resource")

  return new ListSystemPermissionHolderAccountsAdapter(input.database).list({
    permissionKey: input.permissionKey,
    resource: input.resource,
  })
}
