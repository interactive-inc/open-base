import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"

export type SystemOperationAuthorization = Readonly<{
  principalId: string
  assertions: ReadonlyArray<D1PreparedStatement>
}>

/** 呼び出し側が選んだglobal権限を人が現在持つか確認し、保存時に再照合する文を返す。 */
export function prepareSystemHumanOperationAuthorization(
  input: Readonly<{
    database: D1Database
    accountId: string
    tokenVersion: number
    permissions: ReadonlyArray<string>
    now: Date
    requireExplicitPermissions?: boolean
  }>,
): Promise<SystemOperationAuthorization | "forbidden" | Error> {
  return new SystemHumanOperationAuthorizationAdapter({ env: { DB: input.database } }).prepare({
    accountId: input.accountId,
    tokenVersion: input.tokenVersion,
    permissions: input.permissions,
    now: input.now,
    requireExplicitPermissions: input.requireExplicitPermissions,
  })
}
