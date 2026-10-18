import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/**
 * 未失効のbrowser token交換用codeを一度だけ消費し、消費監査と同じbatchで確定する。
 * 発行元credentialのtoken versionと、発行元Session familyが現在も有効かを返し、交換側が照合する。
 */
export class ConsumeSystemBrowserLoginCodeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async consumeSystemBrowserLoginCode(
    codeHash: string,
    now: Date,
  ): Promise<
    | Readonly<{ accountId: AccountId; tokenVersion: number; sessionFamilyActive: boolean }>
    | null
    | Error
  > {
    try {
      const database = this.c.env.DB
      const row = await database
        .prepare(
          `SELECT code.account_id,
                  code.token_version,
                  CASE
                    WHEN code.session_family_id IS NULL THEN 1
                    ELSE EXISTS (
                      SELECT 1 FROM system_sessions AS session
                      WHERE session.family_id = code.session_family_id
                        AND session.account_id = code.account_id
                        AND (session.revoked_at IS NULL OR session.revoked_at > ?2)
                    )
                  END AS session_family_active
           FROM system_browser_login_codes AS code
           WHERE code.code_hash = ?1 AND code.expires_at > ?2
           LIMIT 1`,
        )
        .bind(codeHash, now.getTime())
        .first<{ account_id: string; token_version: number; session_family_active: number }>()
      if (row === null) return null
      const accountId = zAccountId.safeParse(row.account_id)
      if (!accountId.success) return new Error("invalid System AccountEntity ID")
      if (!Number.isSafeInteger(row.token_version) || row.token_version < 0) {
        return new Error("invalid System browser login code token version")
      }

      const audit = SystemAuditEventEntity.create({
        actorAccountId: accountId.data,
        action: SYSTEM_AUDIT_ACTIONS.authBrowserLoginCodeConsumed,
        targetType: "account",
        targetId: accountId.data,
        outcome: "succeeded",
        reasonCode: null,
        authorizationJson: null,
        beforeJson: null,
        afterJson: null,
        metadataJson: null,
        occurredAt: now,
      })
      if (audit instanceof Error) return audit

      const statements = [
        database
          .prepare(
            `DELETE FROM system_browser_login_codes
             WHERE code_hash = ?1 AND account_id = ?2 AND expires_at > ?3`,
          )
          .bind(codeHash, accountId.data, now.getTime()),
        database.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
        ),
        ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
      ]
      const results = await database.batch(statements)

      return results.length === statements.length && results.every((result) => result.success)
        ? Object.freeze({
            accountId: accountId.data,
            tokenVersion: row.token_version,
            sessionFamilyActive: Number(row.session_family_active) === 1,
          })
        : new Error("System browser login code consumption did not succeed")
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to consume System browser login code")
    }
  }
}
