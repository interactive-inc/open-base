import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemD1AuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-authorization.adapter"

/** Accountの現在のロールと付与を読む。 */
export function readSystemAuthorizationGraph(database: D1Database, accountId: AccountId) {
  return new SystemD1AuthorizationAdapter({ env: { DB: database } }).loadForAccount(accountId)
}

export type SystemAuthorizationGraph = NonNullable<
  Exclude<Awaited<ReturnType<typeof readSystemAuthorizationGraph>>, Error>
>
