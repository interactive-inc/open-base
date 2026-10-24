import type { HonoEnv } from "@/bindings"
import { UnauthorizedError } from "@/lib/http/errors"
import { resolveSystemBearerPrincipal } from "@system/interface/operations/resolve-system-bearer-principal"
import { readBearerAuthorization } from "@system/interface/operations/bearer-authorization"
import { SystemServiceBindingAccountChannel } from "@system/interface/request-environment/system-service-binding-account-channel"
import type { Context } from "hono"

const INVALID_TOKEN_MESSAGE = "invalid token"

/**
 * Service Binding RPCが検証済みの主体を渡したときは、Authorization headerを読まずにそれを使う。
 * それ以外はAuthorization headerのBearerだけを読む。
 */
async function resolvePrincipal(
  c: Context<HonoEnv>,
  now: Date,
): Promise<Awaited<ReturnType<typeof resolveSystemBearerPrincipal>>> {
  const serviceBindingAccount = new SystemServiceBindingAccountChannel({ env: c.env }).read()
  if (serviceBindingAccount !== null) {
    return await resolveSystemBearerPrincipal({ env: c.env }, { serviceBindingAccount, now })
  }

  const authorization = readBearerAuthorization(c.req.header("authorization"))
  if (authorization.kind !== "token") throw new UnauthorizedError(INVALID_TOKEN_MESSAGE)
  return await resolveSystemBearerPrincipal({ env: c.env }, { token: authorization.token, now })
}

/**
 * 外部access tokenまたは従来System sessionを検証し、System主体を注入する。
 * Service Binding RPCが検証済みの主体を渡したときは、Authorization headerを読まずにそれを使う。
 */
export async function authenticateSystemBearer(c: Context<HonoEnv>): Promise<void> {
  const now = new Date(c.env.NOW ?? Date.now())
  if (!Number.isSafeInteger(now.getTime())) {
    throw new UnauthorizedError("account authorization is unavailable")
  }

  const principal = await resolvePrincipal(c, now)
  if (principal.kind === "unavailable") {
    throw new UnauthorizedError(
      principal.stage === "authentication"
        ? "account authentication is unavailable"
        : "account authorization is unavailable",
    )
  }
  // System operationの拒否理由（Account不在、非active、失効）は応答へ出さず、Account状態の推測を防ぐ。
  if (principal.kind === "rejected") throw new UnauthorizedError(INVALID_TOKEN_MESSAGE)

  c.set("userId", principal.accountId)
  c.set("accountTokenVersion", principal.tokenVersion)
  c.set("bearerReadAuthentication", principal.readAuthentication)
  c.set("permissions", principal.permissionKeys)
  c.set("scopedPermissions", principal.scopedPermissionKeys)
  c.set("role", principal.roleKeys[0] ?? "authenticated")
  c.set("roleKeys", principal.roleKeys)
}
