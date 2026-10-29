import type { SystemD1Context } from "@system/configuration/system-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

type Context = SystemD1Context

/** 成功監査と同じtransactionで、OIDC資格の認証版が失効していないことを要求する。 */
export class AppendOidcAuthenticatedAuditAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async append(
    input: Readonly<{ accountId: AccountId; tokenVersion: number; audit: SystemAuditEventEntity }>,
  ): Promise<null | Error> {
    try {
      const assertion = this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
        SELECT 1 FROM system_accounts WHERE id=?1 AND token_version=?2 AND status='active' AND closed_at IS NULL
      ) THEN 1 ELSE json_extract('{}','oidc_authentication_changed') END`).bind(
        input.accountId,
        input.tokenVersion,
      )
      const failure = await new SystemAuditEventRepository(this.c).append(input.audit, [assertion])
      return failure ?? null
    } catch (cause) {
      return new Error("OIDC audit unavailable", { cause })
    }
  }
}
