import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import type { PasswordResetTokenHash } from "@system/domain/schemas/auth/password-reset-token-hash.schema"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import type { SystemD1Context } from "@system/configuration/system-context"

type Props = Readonly<{
  challengeId: string
  tokenHash: PasswordResetTokenHash
  accountId: string
  identityId: string
  accountTokenVersion: number
  passwordHash: string
  completedAt: Date
  metadataJson: string | null
}>
type Context = SystemD1Context

/** credential更新・AccountEntity version増加・全Session失効・challenge消費・監査を不可分にする。 */
export class CompleteSystemPasswordResetChallengeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async completeSystemPasswordResetChallenge(props: Props): Promise<boolean | Error> {
    const audit = SystemAuditEventEntity.create({
      actorAccountId: null,
      action: SYSTEM_AUDIT_ACTIONS.authPasswordResetCompleted,
      targetType: "account",
      targetId: props.accountId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: props.metadataJson,
      occurredAt: props.completedAt,
    })
    if (audit instanceof Error) return audit

    try {
      const database = this.c.env.DB
      const completedAt = props.completedAt.getTime()
      const challengeIsAvailable = `EXISTS (
      SELECT 1 FROM system_password_reset_challenges
      WHERE id = ?1 AND token_hash = ?2 AND account_id = ?3 AND identity_id = ?4
        AND used_at IS NULL AND created_at <= ?5 AND expires_at >= ?5
    )`
      const statements = [
        database
          .prepare(
            `UPDATE system_password_credentials
           SET password_hash = ?6,
               changed_at = max(changed_at + 1, ?5),
               updated_at = max(updated_at + 1, ?5)
           WHERE identity_id = ?4 AND ${challengeIsAvailable}`,
          )
          .bind(
            props.challengeId,
            props.tokenHash,
            props.accountId,
            props.identityId,
            completedAt,
            props.passwordHash,
          ),
        abortWhenPreviousStatementChangedNoRows(database),
        database
          .prepare(
            `UPDATE system_identity_bindings
           SET activated_at = coalesce(activated_at, ?5)
           WHERE id = ?4 AND account_id = ?3 AND provider = 'password' AND revoked_at IS NULL
             AND ${challengeIsAvailable}`,
          )
          .bind(props.challengeId, props.tokenHash, props.accountId, props.identityId, completedAt),
        abortWhenPreviousStatementChangedNoRows(database),
        database
          .prepare(
            `UPDATE system_identity_profiles
           SET email_verified = 1, updated_at = max(updated_at, ?5)
           WHERE identity_id = ?4 AND ${challengeIsAvailable}`,
          )
          .bind(props.challengeId, props.tokenHash, props.accountId, props.identityId, completedAt),
        abortWhenPreviousStatementChangedNoRows(database),
        database
          .prepare(
            `UPDATE system_accounts
           SET token_version = token_version + 1, updated_at = max(updated_at, ?5)
           WHERE id = ?3 AND status = 'active' AND token_version = ?6
             AND ${challengeIsAvailable}`,
          )
          .bind(
            props.challengeId,
            props.tokenHash,
            props.accountId,
            props.identityId,
            completedAt,
            props.accountTokenVersion,
          ),
        abortWhenPreviousStatementChangedNoRows(database),
        database
          .prepare(
            `UPDATE system_sessions
           SET revoked_at = max(created_at, coalesce(rotated_at, created_at), ?1)
           WHERE account_id = ?2 AND revoked_at IS NULL`,
          )
          .bind(completedAt, props.accountId),
        database
          .prepare(
            `UPDATE system_password_reset_challenges
           SET used_at = max(created_at, ?5)
           WHERE account_id = ?3 AND identity_id = ?4 AND used_at IS NULL
             AND ${challengeIsAvailable}`,
          )
          .bind(props.challengeId, props.tokenHash, props.accountId, props.identityId, completedAt),
        abortWhenPreviousStatementChangedNoRows(database),
        ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
        database
          .prepare(
            `SELECT CASE WHEN
             EXISTS (
               SELECT 1 FROM system_password_reset_challenges
               WHERE id = ?1 AND token_hash = ?2 AND account_id = ?3 AND identity_id = ?4
                 AND used_at = max(created_at, ?5)
             )
             AND EXISTS (
               SELECT 1 FROM system_accounts
               WHERE id = ?3 AND token_version = ?6 + 1
             )
             AND EXISTS (
               SELECT 1 FROM system_identity_bindings
               WHERE id = ?4 AND account_id = ?3 AND activated_at IS NOT NULL AND revoked_at IS NULL
             )
             AND EXISTS (
               SELECT 1 FROM system_identity_profiles
               WHERE identity_id = ?4 AND email_verified = 1
             )
             AND NOT EXISTS (
               SELECT 1 FROM system_sessions WHERE account_id = ?3 AND revoked_at IS NULL
             )
           THEN 1 ELSE json_extract('', '$') END AS ok`,
          )
          .bind(
            props.challengeId,
            props.tokenHash,
            props.accountId,
            props.identityId,
            completedAt,
            props.accountTokenVersion,
          ),
      ]
      const batchResults = await database.batch(statements)

      return batchResults.length === statements.length &&
        batchResults.every((entry) => entry.success)
        ? true
        : new Error("password reset completion did not succeed")
    } catch (caught) {
      const failure =
        caught instanceof Error ? caught : new Error("failed to complete password reset")

      try {
        const available = await this.c.env.DB.prepare(
          `SELECT 1 AS available FROM system_password_reset_challenges
         WHERE id = ?1 AND token_hash = ?2 AND account_id = ?3 AND identity_id = ?4
           AND used_at IS NULL AND created_at <= ?5 AND expires_at >= ?5`,
        )
          .bind(
            props.challengeId,
            props.tokenHash,
            props.accountId,
            props.identityId,
            props.completedAt.getTime(),
          )
          .first<number>("available")

        return available === null ? false : failure
      } catch {
        return failure
      }
    }
  }
}
