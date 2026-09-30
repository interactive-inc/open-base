import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { ResolveBearerAccountAdapter } from "@system/infrastructure/adapters/auth/resolve-bearer-account.adapter"
import { SystemD1AuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-authorization.adapter"

export type SystemBearerPrincipalResolution =
  | Readonly<{
      kind: "authorized"
      accountId: AccountId
      tokenVersion: number
      readAuthentication: SystemReadAuthentication
      permissionKeys: ReadonlySet<string>
      scopedPermissionKeys: ReadonlyMap<string, ReadonlySet<string>>
      roleKeys: ReadonlyArray<string>
    }>
  | Readonly<{ kind: "rejected" }>
  | Readonly<{ kind: "unavailable"; stage: "authentication" | "authorization" }>

/**
 * Bearerを外部access tokenまたはSystem sessionとして検証し、主体と現在のglobal権限を返す。
 * 拒否理由は返さず、Account状態の推測を防ぐ。HTTP middlewareへの注入は呼び出し側が行う。
 */
export async function resolveSystemBearerPrincipal(
  context: ConstructorParameters<typeof ResolveBearerAccountAdapter>[0],
  input: Readonly<{ token: string; now: Date }>,
): Promise<SystemBearerPrincipalResolution> {
  if (!Number.isSafeInteger(input.now.getTime()))
    return { kind: "unavailable", stage: "authorization" }
  const account = await new ResolveBearerAccountAdapter(context).resolve({
    token: input.token,
    now: input.now,
  })
  if (account.kind === "unavailable") return { kind: "unavailable", stage: "authentication" }
  if (account.kind === "rejected") return { kind: "rejected" }
  const authorization = await new SystemD1AuthorizationAdapter({
    env: { DB: context.env.DB },
  }).resolveForAccount({ accountId: account.accountId, resource: null, at: input.now })
  if (authorization instanceof Error) return { kind: "unavailable", stage: "authorization" }
  if (authorization === null) return { kind: "rejected" }
  return {
    kind: "authorized",
    accountId: account.accountId,
    tokenVersion: account.tokenVersion,
    readAuthentication: account.readAuthentication,
    permissionKeys: authorization.permissionKeys,
    scopedPermissionKeys: authorization.scopedPermissionKeys,
    roleKeys: authorization.roleKeys,
  }
}
