import { SystemServiceOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-service-operation-authorization.adapter"

/** 呼び出し側が選んだglobal権限をservice principalが現在持つか確認し、保存時に再照合する文を返す。 */
export function prepareSystemServiceOperationAuthorization(
  input: Readonly<{
    database: D1Database
    accountId: string
    tokenVersion: number
    permissions: ReadonlyArray<string>
    now: Date
  }>,
): Promise<
  | Readonly<{ principalId: string; assertions: ReadonlyArray<D1PreparedStatement> }>
  | "forbidden"
  | Error
> {
  return new SystemServiceOperationAuthorizationAdapter({ env: { DB: input.database } }).prepare({
    accountId: input.accountId,
    tokenVersion: input.tokenVersion,
    permissions: input.permissions,
    now: input.now,
  })
}
