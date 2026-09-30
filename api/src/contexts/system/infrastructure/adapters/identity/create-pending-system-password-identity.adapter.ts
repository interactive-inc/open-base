import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { PasswordResetTokenHash } from "@system/domain/schemas/auth/password-reset-token-hash.schema"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { zIdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import type { SystemD1Context } from "@system/configuration/system-context"

export type PendingSystemPasswordIdentityResult =
  | Readonly<{ identityId: string; challengeId: string }>
  | "account_not_found"
  | "duplicate"
  | Error
type Context = SystemD1Context

/** 未設定password Identity・仮credential・設定challenge・監査を一つのSystem transactionで作る。 */
export class CreatePendingSystemPasswordIdentityAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async createPendingSystemPasswordIdentity(
    input: Readonly<{
      actorAccountId: string
      accountId: string
      email: string
      pendingPasswordHash: string
      tokenHash: PasswordResetTokenHash
      now: Date
      expiresAt: Date
      metadataJson: string | null
    }>,
  ): Promise<PendingSystemPasswordIdentityResult> {
    const actorAccountId = zAccountId.safeParse(input.actorAccountId)
    const accountId = zAccountId.safeParse(input.accountId)
    const subject = identitySubjectSchema.safeParse(input.email)
    const identityId = zIdentityId.safeParse(crypto.randomUUID())
    const challengeId = crypto.randomUUID()
    const now = input.now.getTime()
    const expiresAt = input.expiresAt.getTime()
    if (
      !actorAccountId.success ||
      !accountId.success ||
      !subject.success ||
      !identityId.success ||
      input.pendingPasswordHash.length < 20 ||
      !Number.isSafeInteger(now) ||
      !Number.isSafeInteger(expiresAt) ||
      expiresAt <= now
    ) {
      return new Error("pending System password Identity input is invalid")
    }

    try {
      const database = this.c.env.DB
      const accountExists = await database
        .prepare("SELECT 1 AS found FROM system_accounts WHERE id = ?1 AND status = 'active'")
        .bind(accountId.data)
        .first<number>("found")
      if (accountExists === null) return "account_not_found"

      const afterJson = StableSystemAuditJsonValue.create({
        account_id: accountId.data,
        email: subject.data,
        provider: "password",
        state: "pending",
      })
      if (afterJson instanceof Error) return afterJson
      const identityAudit = SystemAuditEventEntity.create({
        actorAccountId: actorAccountId.data,
        action: SYSTEM_AUDIT_ACTIONS.systemIdentityCreated,
        targetType: "system:identity",
        targetId: identityId.data,
        outcome: "succeeded",
        reasonCode: null,
        authorizationJson: null,
        beforeJson: null,
        afterJson: afterJson?.toString() ?? null,
        metadataJson: input.metadataJson,
        occurredAt: input.now,
      })
      const challengeAudit = SystemAuditEventEntity.create({
        actorAccountId: actorAccountId.data,
        action: SYSTEM_AUDIT_ACTIONS.authPasswordSetupRequested,
        targetType: "system:identity",
        targetId: identityId.data,
        outcome: "succeeded",
        reasonCode: null,
        authorizationJson: null,
        beforeJson: null,
        afterJson: null,
        metadataJson: input.metadataJson,
        occurredAt: input.now,
      })
      if (identityAudit instanceof Error) return identityAudit
      if (challengeAudit instanceof Error) return challengeAudit
      const auditRepository = new SystemAuditEventRepository(this.c)
      const statements = [
        database
          .prepare(
            `INSERT INTO system_identity_bindings
             (id, account_id, provider, subject, created_at, activated_at, revoked_at)
           VALUES (?1, ?2, 'password', ?3, ?4, NULL, NULL)`,
          )
          .bind(identityId.data, accountId.data, subject.data, now),
        database
          .prepare(
            `INSERT INTO system_identity_profiles
             (identity_id, email, email_verified, last_used_at, updated_at)
           VALUES (?1, ?2, 0, NULL, ?3)`,
          )
          .bind(identityId.data, subject.data, now),
        database
          .prepare(
            `INSERT INTO system_password_credentials
             (identity_id, password_hash, changed_at, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?3, ?3)`,
          )
          .bind(identityId.data, input.pendingPasswordHash, now),
        database
          .prepare(
            `INSERT INTO system_password_reset_challenges
             (id, token_hash, account_id, identity_id, created_at, expires_at, used_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)`,
          )
          .bind(challengeId, input.tokenHash, accountId.data, identityId.data, now, expiresAt),
        database
          .prepare(
            `UPDATE system_accounts
           SET token_version = token_version + 1, updated_at = max(updated_at, ?2)
           WHERE id = ?1 AND status = 'active' AND token_version < 9007199254740991`,
          )
          .bind(accountId.data, now),
        database.prepare("SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END"),
        ...auditRepository.prepareAppend(identityAudit),
        ...auditRepository.prepareAppend(challengeAudit),
        database
          .prepare(
            `SELECT CASE WHEN
             EXISTS (SELECT 1 FROM system_identity_bindings WHERE id = ?1 AND activated_at IS NULL)
             AND EXISTS (SELECT 1 FROM system_password_credentials WHERE identity_id = ?1)
             AND EXISTS (
               SELECT 1 FROM system_password_reset_challenges
               WHERE id = ?2 AND identity_id = ?1 AND used_at IS NULL
             )
           THEN 1 ELSE json_extract('', '$') END`,
          )
          .bind(identityId.data, challengeId),
      ]
      const results = await database.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("pending System password Identity batch did not succeed")
      }

      return Object.freeze({ identityId: identityId.data, challengeId })
    } catch (caught) {
      if (caught instanceof Error && caught.message.toLowerCase().includes("unique")) {
        return "duplicate"
      }

      return caught instanceof Error
        ? caught
        : new Error("failed to create pending System password Identity")
    }
  }
}
