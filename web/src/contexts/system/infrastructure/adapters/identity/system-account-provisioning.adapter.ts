import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import type { IamRoleId } from "@system/domain/schemas/iam/iam-role.schema"
import type { IdentityProvider } from "@system/domain/schemas/identity/identity-provider.schema"
import { zIdentityId, type IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import type { SystemD1Context } from "@system/configuration/system-context"
import type { IamRoleEntity } from "@system/domain/entities/iam-role.entity"
import { SystemD1AuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-authorization.adapter"

export type PreparedSystemAccountProvisioning = Readonly<{
  accountId: AccountId
  identityId: IdentityId
  accountStatement: D1PreparedStatement
  identityStatements: ReadonlyArray<D1PreparedStatement>
}>
type Context = SystemD1Context

/** 新規Account・Identity・Role Bindingを一つのSystem変更単位として準備する。 */
export class SystemAccountProvisioningAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async canGrantInitialRole(
    actorAccountId: AccountId,
    role: IamRoleEntity,
    now: Date,
  ): Promise<boolean | Error> {
    if (role.resourceType !== null) return false
    const authorization = await new SystemD1AuthorizationAdapter(this.c).resolveForAccount({
      accountId: actorAccountId,
      resource: null,
      at: now,
    })
    if (authorization instanceof Error) return authorization
    if (authorization === null) return false
    return (
      authorization.permissionKeys.has("system:admin") ||
      (authorization.permissionKeys.has("iam:write") &&
        role.permissionKeys.every((permission) => authorization.permissionKeys.has(permission)))
    )
  }

  prepare(input: {
    actorAccountId: AccountId | null
    provider: IdentityProvider
    subject: string
    email: string
    passwordHash: string | null
    roleId: IamRoleId
    now: Date
  }): PreparedSystemAccountProvisioning | Error {
    const accountId = zAccountId.safeParse(crypto.randomUUID())
    const identityId = zIdentityId.safeParse(crypto.randomUUID())
    const subject = identitySubjectSchema.safeParse(input.subject)
    if (!accountId.success || !identityId.success || !subject.success) {
      return new Error("invalid System provisioning identity")
    }
    if (
      !Number.isSafeInteger(input.now.getTime()) ||
      (input.provider === "password") !== (input.passwordHash !== null)
    ) {
      return new Error("invalid System provisioning input")
    }
    const afterJson = StableSystemAuditJsonValue.create({
      identity_id: identityId.data,
      identity_provider: input.provider,
      role_id: input.roleId,
      status: "active",
    })
    if (afterJson instanceof Error) return afterJson
    const auditEvent = SystemAuditEventEntity.create({
      actorAccountId: input.actorAccountId,
      action: SYSTEM_AUDIT_ACTIONS.systemAccountProvisioned,
      targetType: "system:account",
      targetId: accountId.data,
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
    const accountStatement = database
      .prepare(
        `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`,
      )
      .bind(accountId.data, input.now.getTime())
    const identityStatements = [
      database
        .prepare(
          `INSERT INTO system_principals
             (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
           VALUES (?1, ?2, 'human', ?3, NULL, 1, ?4, ?4)`,
        )
        .bind(crypto.randomUUID(), accountId.data, input.email, input.now.getTime()),
      database
        .prepare(
          `WITH actor_permissions AS (
             SELECT DISTINCT permission.permission_key AS key
             FROM system_accounts account
             INNER JOIN system_role_bindings binding ON binding.account_id = account.id
             INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
             WHERE account.id = ?1 AND account.status = 'active'
               AND binding.resource_type IS NULL AND binding.revoked_at IS NULL
               AND binding.created_at <= ?3
           ), target_permissions AS (
             SELECT permission_key AS key FROM system_iam_role_permissions WHERE role_id = ?2
           )
           SELECT CASE WHEN ?1 IS NULL
             OR EXISTS (SELECT 1 FROM actor_permissions WHERE key = 'system:admin')
             OR (
               EXISTS (SELECT 1 FROM actor_permissions WHERE key = 'iam:write')
               AND NOT EXISTS (
                 SELECT 1 FROM target_permissions target
                 WHERE NOT EXISTS (
                   SELECT 1 FROM actor_permissions actor WHERE actor.key = target.key
                 )
               )
             )
           THEN 1 ELSE abs(-9223372036854775808) END AS ok`,
        )
        .bind(input.actorAccountId, input.roleId, input.now.getTime()),
      database
        .prepare(
          `INSERT INTO system_identity_bindings
             (id, account_id, provider, subject, created_at, activated_at, revoked_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?5, NULL)`,
        )
        .bind(identityId.data, accountId.data, input.provider, subject.data, input.now.getTime()),
      database
        .prepare(
          `INSERT INTO system_identity_profiles
             (identity_id, email, email_verified, last_used_at, updated_at)
           VALUES (?1, ?2, 1, NULL, ?3)`,
        )
        .bind(identityId.data, input.email, input.now.getTime()),
      ...(input.passwordHash === null
        ? []
        : [
            database
              .prepare(
                `INSERT INTO system_password_credentials
                   (identity_id, password_hash, changed_at, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?3, ?3)`,
              )
              .bind(identityId.data, input.passwordHash, input.now.getTime()),
          ]),
      database
        .prepare(
          `INSERT INTO system_role_bindings
             (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
           VALUES (?1, ?2, ?3, NULL, NULL, ?4, NULL)`,
        )
        .bind(crypto.randomUUID(), accountId.data, input.roleId, input.now.getTime()),
      ...new SystemAuditEventRepository(this.c).prepareAppend(auditEvent),
    ]

    return Object.freeze({
      accountId: accountId.data,
      identityId: identityId.data,
      accountStatement,
      identityStatements: Object.freeze(identityStatements),
    })
  }
}
