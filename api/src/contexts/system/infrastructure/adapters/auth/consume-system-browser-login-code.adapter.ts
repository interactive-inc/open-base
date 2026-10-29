import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/** 未失効のbrowser token交換用codeを一度だけ消費し、消費監査と同じbatchで確定する。 */
export class ConsumeSystemBrowserLoginCodeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async consumeSystemBrowserLoginCode(
    codeHash: string,
    now: Date,
  ): Promise<Readonly<{ accountId: AccountId; tokenVersion: number }> | null | Error> {
    try {
      const database = this.c.env.DB
      const row = await database
        .prepare(
          `SELECT account_id, token_version
           FROM system_browser_login_codes
           WHERE code_hash = ?1 AND created_at <= ?2 AND expires_at > ?2
             AND EXISTS (SELECT 1 FROM system_accounts account WHERE account.id=account_id AND account.status='active' AND account.closed_at IS NULL AND account.token_version=system_browser_login_codes.token_version)
           LIMIT 1`,
        )
        .bind(codeHash, now.getTime())
        .first<{ account_id: string; token_version: number }>()
      if (row === null) return null
      const accountId = zAccountId.safeParse(row.account_id)
      if (!accountId.success || !Number.isSafeInteger(row.token_version) || row.token_version < 0)
        return new Error("invalid System AccountEntity ID")

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
             WHERE code_hash = ?1 AND account_id = ?2 AND created_at <= ?3 AND expires_at > ?3 AND token_version=?4
               AND EXISTS (SELECT 1 FROM system_accounts account WHERE account.id=account_id AND account.status='active' AND account.closed_at IS NULL AND account.token_version=system_browser_login_codes.token_version)`,
          )
          .bind(codeHash, accountId.data, now.getTime(), row.token_version),
        database.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
        ),
        ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
      ]
      const results = await database.batch(statements)

      return results.length === statements.length && results.every((result) => result.success)
        ? Object.freeze({ accountId: accountId.data, tokenVersion: row.token_version })
        : new Error("System browser login code consumption did not succeed")
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to consume System browser login code")
    }
  }
}
