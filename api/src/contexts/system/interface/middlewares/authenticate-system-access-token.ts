import { ResolveBearerAccountAdapter } from "@system/infrastructure/adapters/auth/resolve-bearer-account.adapter"
import { SystemInvalidSessionError, SystemSessionUnavailableError } from "@system/interface/errors"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { SystemD1AuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-authorization.adapter"
import { readBearerAuthorization } from "@system/interface/operations/bearer-authorization"

/** access tokenと現在のAccount / IAM状態を検証してSystem主体だけを注入する。 */
export const authenticateSystemAccessToken = systemFactory.createMiddleware(
  async (context, next) => {
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemSessionUnavailableError()
    }

    const authorization = readBearerAuthorization(context.req.header("authorization"))
    if (authorization.kind !== "token") {
      throw new SystemInvalidSessionError()
    }

    const authentication = await new ResolveBearerAccountAdapter({ env: context.env }).resolve({
      token: authorization.token,
      now,
    })
    if (authentication.kind === "unavailable") throw new SystemSessionUnavailableError()
    if (authentication.kind === "rejected") throw new SystemInvalidSessionError()

    const accountAuthorization = await new SystemD1AuthorizationAdapter({
      env: { DB: context.env.DB },
    }).resolveForAccount({ accountId: authentication.accountId, resource: null, at: now })
    if (accountAuthorization instanceof Error) {
      throw new SystemSessionUnavailableError()
    }
    if (accountAuthorization === null) {
      throw new SystemInvalidSessionError()
    }

    context.set("userId", authentication.accountId)
    context.set("systemAccessToken", authentication.systemAccessToken)
    context.set("bearerReadAuthentication", authentication.readAuthentication)
    context.set("accountTokenVersion", authentication.tokenVersion)
    context.set("permissions", accountAuthorization.permissionKeys)
    context.set("scopedPermissions", accountAuthorization.scopedPermissionKeys)
    context.set("role", accountAuthorization.roleKeys[0] ?? "authenticated")
    context.set("roleKeys", accountAuthorization.roleKeys)
    await next()
  },
)
