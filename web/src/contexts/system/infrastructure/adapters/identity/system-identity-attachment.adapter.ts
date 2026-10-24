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

/**
 * 操作主体が対象Accountとしてsign inできる経路を足してよいかを判定する。
 * system:admin、またはiam:writeと対象Accountの全権限を持つ有効なglobal割当だけを許可する。
 * 対象の権限はresource割当や開始前の割当も含め、操作主体の権限を超える昇格を防ぐ。
 */
function attachmentAuthoritySql(otherwise: string): string {
  return `WITH actor_permissions AS (
       SELECT DISTINCT permission.permission_key AS key
       FROM system_accounts account
       INNER JOIN system_role_bindings binding ON binding.account_id = account.id
       INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
       WHERE account.id = ?1 AND account.status = 'active'
         AND binding.resource_type IS NULL AND binding.revoked_at IS NULL
         AND binding.created_at <= ?3
     ), target_permissions AS (
       SELECT DISTINCT permission.permission_key AS key
       FROM system_role_bindings binding
       INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
       WHERE binding.account_id = ?2 AND binding.revoked_at IS NULL
     )
     SELECT CASE WHEN
       EXISTS (SELECT 1 FROM actor_permissions WHERE key = 'system:admin')
       OR (
         EXISTS (SELECT 1 FROM actor_permissions WHERE key = 'iam:write')
         AND NOT EXISTS (
           SELECT 1 FROM target_permissions target
           WHERE NOT EXISTS (
             SELECT 1 FROM actor_permissions actor WHERE actor.key = target.key
           )
         )
       )
     THEN 1 ELSE ${otherwise} END AS ok`
}

/** 既存Accountへのmachine-managed Identity追加を監査込みで準備する。 */
export class SystemIdentityAttachmentAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /** 対象Accountへの追加を操作主体に許すかを返す。評価できない場合はErrorを返す。 */
  async canAttach(input: {
    accountId: AccountId
    actorAccountId: AccountId
    now: Date
  }): Promise<boolean | Error> {
    if (!Number.isSafeInteger(input.now.getTime())) return false
    try {
      const ok = await this.c.env.DB.prepare(attachmentAuthoritySql("0"))
        .bind(input.actorAccountId, input.accountId, input.now.getTime())
        .first<number>("ok")
      return ok === 1
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to evaluate System Identity attachment authority")
    }
  }

  prepare(input: {
    accountId: AccountId
    actorAccountId: AccountId
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
      actorAccountId: input.actorAccountId,
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
      // 事前判定の後に権限が変わっても、同じ変更単位の中で再検査して昇格を拒否する。
      database
        .prepare(attachmentAuthoritySql("abs(-9223372036854775808)"))
        .bind(input.actorAccountId, input.accountId, input.now.getTime()),
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
