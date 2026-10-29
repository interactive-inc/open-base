import type { SystemClockContext, SystemD1Context } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"

type Context = SystemD1Context & SystemClockContext

/** 公開送信者の現在の資格を固定し、通知保存のtransactionでも失権と期限切れを拒否する。 */
export class SystemNotificationPublicationAuthorizationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(authentication: SystemReadAuthentication) {
    const authorization = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      authentication,
      this.c.var.now(),
    )
    if (authorization === null || authorization instanceof Error) return authorization
    if (
      !authorization.permissionKeys.has("system:admin") &&
      !authorization.permissionKeys.has(SystemFeaturePermission.NOTIFICATION_SEND.key)
    )
      return null

    return () => authorization.assertions(this.c.var.now())
  }
}
