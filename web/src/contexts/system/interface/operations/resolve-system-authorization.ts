import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { RoleBindingResource } from "@system/domain/schemas/iam/role-binding.schema"
import { SystemD1AuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-authorization.adapter"

/** Accountの指定時点・資源に対する権限を解決する。 */
export function resolveSystemAuthorization(
  database: D1Database,
  command: Readonly<{
    accountId: AccountId
    resource: RoleBindingResource | null
    at: Date
  }>,
) {
  return new SystemD1AuthorizationAdapter({ env: { DB: database } }).resolveForAccount(command)
}

export type ResolvedSystemAuthorization = NonNullable<
  Exclude<Awaited<ReturnType<typeof resolveSystemAuthorization>>, Error>
>
