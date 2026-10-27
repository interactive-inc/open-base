import { ApplicationForbiddenError } from "@system/application/errors"
import { PermissionValue } from "@system/domain/values/iam/permission.value"
import type { MiddlewareHandler } from "hono"

type PermissionEnvironment = Readonly<{
  Variables: Readonly<{ permissions: ReadonlySet<string> }>
}>

/** 認証済みrequestへSystemが注入したpermission集合を、context非依存に検証する。 */
export function requireAnyPermission(
  ...permissions: ReadonlyArray<PermissionValue>
): MiddlewareHandler<PermissionEnvironment> {
  return async (context, next) => {
    if (!PermissionValue.hasAny(context.var.permissions, ...permissions)) {
      throw new ApplicationForbiddenError()
    }

    await next()
  }
}
