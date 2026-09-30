import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import type { IdentityProvider } from "@system/domain/schemas/identity/identity-provider.schema"
import { zIdentityId, type IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import type { SystemD1Context } from "@system/configuration/system-context"

export type PreparedSystemIdentityAttachment = Readonly<{
  identityId: IdentityId
  statements: ReadonlyArray<D1PreparedStatement>
}>
type Context = SystemD1Context

/** 既存Accountへのmachine-managed Identity追加を監査込みで準備する。 */
export class SystemIdentityAttachmentAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(input: {
    accountId: AccountId
    actorAccountId?: AccountId
    provider: IdentityProvider
    subject: string
    email: string
    now: Date
  }): PreparedSystemIdentityAttachment | Error {
    const identityId = zIdentityId.safeParse(crypto.randomUUID())
    const subject = identitySubjectSchema.safeParse(input.subject)
    if (!identityId.success || !subject.success || !Number.isSafeInteger(input.now.getTime())) {
      return new Error("invalid System Identity attachment")
    }
    const afterJson = StableSystemAuditJsonValue.create({
      account_id: input.accountId,
      provider: input.provider,
    })
    if (afterJson instanceof Error) return afterJson
    const auditEvent = SystemAuditEventEntity.create({
      actorAccountId: input.actorAccountId ?? null,
      action: SYSTEM_AUDIT_ACTIONS.systemIdentityAttached,
      targetType: "system:identity",
      targetId: identityId.data,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: afterJson?.toString() ?? null,
      metadataJson: null,
      occurredAt: input.now,
    })
    if (auditEvent instanceof Error) return auditEvent
    const database = this.c.env.DB
    const statements = [
      database
        .prepare(
          `INSERT INTO system_identity_bindings
             (id, account_id, provider, subject, created_at, activated_at, revoked_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?5, NULL
           WHERE EXISTS (SELECT 1 FROM system_accounts WHERE id = ?2)`,
        )
        .bind(identityId.data, input.accountId, input.provider, subject.data, input.now.getTime()),
      database.prepare(
        "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
      ),
      database
        .prepare(
          `INSERT INTO system_identity_profiles
             (identity_id, email, email_verified, last_used_at, updated_at)
           VALUES (?1, ?2, 1, NULL, ?3)`,
        )
        .bind(identityId.data, input.email, input.now.getTime()),
      database
        .prepare(
          `UPDATE system_accounts
           SET token_version = token_version + 1, updated_at = max(updated_at, ?2)
           WHERE id = ?1 AND token_version < 9007199254740991`,
        )
        .bind(input.accountId, input.now.getTime()),
      database.prepare(
        "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
      ),
      ...new SystemAuditEventRepository(this.c).prepareAppend(auditEvent),
    ]

    return Object.freeze({ identityId: identityId.data, statements: Object.freeze(statements) })
  }
}
