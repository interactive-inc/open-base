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

  async prepare(authentication: SystemReadAuthentication, sessionFamilyId: string | null) {
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

    return () => {
      const at = this.c.var.now()
      const assertions = authorization.assertions(at)
      if (assertions instanceof Error || sessionFamilyId === null) return assertions
      // Accountのtoken versionを変えないlogoutも、発行元familyの失効として拒否する。
      return [
        ...assertions,
        this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM system_sessions WHERE family_id=?1 AND account_id=?2
            AND (revoked_at IS NULL OR revoked_at>max(?3,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)))
          ) THEN 1 ELSE json_extract('{}','system_notification_sender_session_changed') END`).bind(
          sessionFamilyId,
          authentication.accountId,
          at.getTime(),
        ),
      ]
    }
  }
}
