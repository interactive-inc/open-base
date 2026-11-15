import { systemSessionFamilyEligibilitySql } from "@system/infrastructure/adapters/auth/lib/system-session-family-eligibility-sql"
import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemSessionSource } from "@system/domain/definitions/auth/system-session-issuance.definition"
import { zSessionFamilyId } from "@system/domain/schemas/auth/session-family-id.schema"
type Context = SystemD1Context

/**
 * 未失効のbrowser token交換用codeを一度だけ消費し、消費監査と同じbatchで確定する。
 * 発行元credentialのtoken versionと、発行元Session familyが現在も有効かを返し、交換側が照合する。
 * Session familyは、失効しておらず期限も切れていないSessionが残っているときだけ有効とする。
 */
export class ConsumeSystemBrowserLoginCodeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async consumeSystemBrowserLoginCode(
    codeHash: string,
    now: Date,
  ): Promise<
    | Readonly<{
        accountId: AccountId
        tokenVersion: number
        sessionFamilyActive: boolean
        sourceSession: SystemSessionSource | null
      }>
    | null
    | Error
  > {
    try {
      const database = this.c.env.DB
      const row = await database
        .prepare(
          `SELECT code.account_id,
                  code.token_version,
                  code.session_family_id,
                  (SELECT min(coalesce(origin.authenticated_at, origin.created_at))
                    FROM system_sessions origin WHERE origin.family_id = code.session_family_id
                      AND origin.account_id = code.account_id) AS family_authenticated_at,
                  CASE
                    WHEN code.session_family_id IS NULL THEN 0
                    ELSE EXISTS (
                      SELECT 1 FROM system_sessions AS session
                      WHERE session.family_id = code.session_family_id
                        AND session.account_id = code.account_id
                        AND session.token_version = code.token_version
                        AND session.rotated_at IS NULL
                        AND session.revoked_at IS NULL
                        AND session.expires_at > ?2
                        AND ${systemSessionFamilyEligibilitySql}
                    )
                  END AS session_family_active
           FROM system_browser_login_codes AS code
           WHERE code.code_hash = ?1 AND code.expires_at > ?2
           LIMIT 1`,
        )
        .bind(codeHash, now.getTime())
        .first<{
          account_id: string
          token_version: number
          session_family_active: number
          session_family_id: string | null
          family_authenticated_at: number | null
        }>()
      if (row === null) return null
      const accountId = zAccountId.safeParse(row.account_id)
      if (!accountId.success) return new Error("invalid System AccountEntity ID")
      if (!Number.isSafeInteger(row.token_version) || row.token_version < 0) {
        return new Error("invalid System browser login code token version")
      }
      let sourceSession: SystemSessionSource | null = null
      if (Number(row.session_family_active) === 1) {
        const familyId = zSessionFamilyId.safeParse(row.session_family_id)
        if (
          !familyId.success ||
          row.family_authenticated_at === null ||
          !Number.isSafeInteger(row.family_authenticated_at) ||
          row.family_authenticated_at < 0 ||
          row.family_authenticated_at > now.getTime()
        ) {
          return new Error("invalid System browser login code origin")
        }
        sourceSession = Object.freeze({
          familyId: familyId.data,
          authenticatedAt: new Date(row.family_authenticated_at),
        })
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
            sourceSession,
          })
        : new Error("System browser login code consumption did not succeed")
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to consume System browser login code")
    }
  }
}
