import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/** Account停止・token失効・保護権限保持者とSystem rootの残存・監査を同じbatchへ準備する。 */
export class SystemAccountSuspensionAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(input: {
    actorAccountId: AccountId
    targetAccountId: AccountId
    protectedPermissionKeys: ReadonlyArray<string>
    now: Date
  }): ReadonlyArray<D1PreparedStatement> | Error {
    if (!Number.isSafeInteger(input.now.getTime())) return new Error("invalid suspension time")
    const protectedPermissionKeys = [...new Set(input.protectedPermissionKeys)]
    if (protectedPermissionKeys.length === 0 || protectedPermissionKeys.length > 100) {
      return new Error("invalid protected permission keys")
    }
    if (protectedPermissionKeys.some((key) => key.length === 0 || key.length > 200)) {
      return new Error("invalid protected permission keys")
    }
    const afterJson = StableSystemAuditJsonValue.create({ status: "suspended" })
    if (afterJson instanceof Error) return afterJson
    const auditEvent = SystemAuditEventEntity.create({
      actorAccountId: input.actorAccountId,
      action: SYSTEM_AUDIT_ACTIONS.systemAccountSuspended,
      targetType: "system:account",
      targetId: input.targetAccountId,
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
    const protectedPermissionPlaceholders = protectedPermissionKeys
      .map((_, index) => `?${index + 2}`)
      .join(", ")
    const protectedPermissionCountIndex = protectedPermissionKeys.length + 2

    return Object.freeze([
      database
        .prepare(
          `SELECT CASE WHEN EXISTS (
             SELECT 1
             FROM system_accounts target
             INNER JOIN system_identity_bindings identity ON identity.account_id = target.id
             WHERE target.id = ?1 AND target.status = 'active'
               AND identity.activated_at IS NOT NULL AND identity.revoked_at IS NULL
               AND (
                 SELECT COUNT(DISTINCT permission.permission_key)
                 FROM system_role_bindings binding
                 INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
                 WHERE binding.account_id = target.id
                   AND binding.resource_type IS NULL AND binding.revoked_at IS NULL
                   AND permission.permission_key IN (${protectedPermissionPlaceholders})
               ) = ?${protectedPermissionCountIndex}
           ) AND NOT EXISTS (
             SELECT 1
             FROM system_accounts account
             INNER JOIN system_identity_bindings identity ON identity.account_id = account.id
             WHERE account.id <> ?1 AND account.status = 'active'
               AND identity.activated_at IS NOT NULL AND identity.revoked_at IS NULL
               AND (
                 SELECT COUNT(DISTINCT permission.permission_key)
                 FROM system_role_bindings binding
                 INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
                 WHERE binding.account_id = account.id
                   AND binding.resource_type IS NULL AND binding.revoked_at IS NULL
                   AND permission.permission_key IN (${protectedPermissionPlaceholders})
               ) = ?${protectedPermissionCountIndex}
           ) THEN json_extract('', '$') ELSE 1 END AS ok`,
        )
        .bind(input.targetAccountId, ...protectedPermissionKeys, protectedPermissionKeys.length),
      database
        .prepare(
          `UPDATE system_accounts
           SET status = 'suspended', token_version = token_version + 1,
               updated_at = max(updated_at, ?2)
           WHERE id = ?1 AND status <> 'suspended' AND token_version < 9007199254740991`,
        )
        .bind(input.targetAccountId, input.now.getTime()),
      database.prepare(
        "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
      ),
      database.prepare(
        `SELECT CASE WHEN EXISTS (
           SELECT 1
           FROM system_accounts account
           INNER JOIN system_identity_bindings identity ON identity.account_id = account.id
           INNER JOIN system_role_bindings binding ON binding.account_id = account.id
           INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
           WHERE account.status = 'active'
             AND identity.activated_at IS NOT NULL AND identity.revoked_at IS NULL
             AND binding.resource_type IS NULL AND binding.revoked_at IS NULL
             AND permission.permission_key = 'system:admin'
         ) THEN 1 ELSE json_extract('', '$') END AS ok`,
      ),
      ...new SystemAuditEventRepository(this.c).prepareAppend(auditEvent),
    ])
  }
}
