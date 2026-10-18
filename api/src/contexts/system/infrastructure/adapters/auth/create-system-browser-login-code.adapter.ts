import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { SessionFamilyId } from "@system/domain/schemas/auth/session-family-id.schema"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/** browser token交換用codeのhashとAccount、発行元credentialの束縛を短期間保存し、発行監査と同じbatchで確定する。 */
export class CreateSystemBrowserLoginCodeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async createSystemBrowserLoginCode(
    input: Readonly<{
      codeHash: string
      accountId: AccountId
      tokenVersion: number
      sessionFamilyId: SessionFamilyId | null
      createdAt: Date
      expiresAt: Date
    }>,
  ): Promise<null | Error> {
    const audit = SystemAuditEventEntity.create({
      actorAccountId: input.accountId,
      action: SYSTEM_AUDIT_ACTIONS.authBrowserLoginCodeCreated,
      targetType: "account",
      targetId: input.accountId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt: input.createdAt,
    })
    if (audit instanceof Error) return audit

    try {
      const database = this.c.env.DB
      const statements = [
        database
          .prepare(
            `INSERT INTO system_browser_login_codes
             (code_hash, account_id, token_version, session_family_id, created_at, expires_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
          )
          .bind(
            input.codeHash,
            input.accountId,
            input.tokenVersion,
            input.sessionFamilyId,
            input.createdAt.getTime(),
            input.expiresAt.getTime(),
          ),
        ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
      ]
      const results = await database.batch(statements)

      return results.length === statements.length && results.every((result) => result.success)
        ? null
        : new Error("System browser login code creation did not succeed")
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to create System browser login code")
    }
  }
}
