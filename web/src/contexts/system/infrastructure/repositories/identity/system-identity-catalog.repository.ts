import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { IdentityBindingEntity } from "@system/domain/entities/identity-binding.entity"
import type { IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import type { SystemD1Context } from "@system/configuration/system-context"

type IdentityRow = Readonly<{
  id: unknown
  account_id: unknown
  provider: unknown
  subject: unknown
  email: unknown
  email_verified: unknown
  last_used_at: unknown
  created_at: unknown
  activated_at: unknown
  revoked_at: unknown
}>

type AccountEmailRow = Readonly<{
  account_id: AccountId
  email: string
}>

const ACCOUNT_EMAIL_QUERY_CHUNK_SIZE = 50

export type SystemIdentityCatalogView = Readonly<{
  binding: IdentityBindingEntity
  email: string | null
  isEmailVerified: boolean
  lastUsedAt: Date | null
}>

export type SystemIdentityMutation =
  | "created"
  | "revoked"
  | "not_found"
  | "conflict"
  | "forbidden"
  | "last_active_identity"
  | "last_root"

type CreateProps = Readonly<{
  actorAccountId: AccountId
  binding: IdentityBindingEntity
  email: string | null
  isEmailVerified: boolean
  passwordHash: string | null
  auditStatements: ReadonlyArray<D1PreparedStatement>
}>

type RevokeProps = Readonly<{
  actorAccountId: AccountId
  identity: SystemIdentityCatalogView
  now: Date
  auditStatements: ReadonlyArray<D1PreparedStatement>
}>
type Context = SystemD1Context

/** Accountのlogin Identityとcredential projectionをCompanyなしで保存する。 */
export class SystemIdentityCatalogRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany(accountId: AccountId): Promise<ReadonlyArray<SystemIdentityCatalogView> | Error> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT identity.id, identity.account_id, identity.provider, identity.subject,
                identity.created_at, identity.activated_at, identity.revoked_at,
                profile.email, profile.email_verified, profile.last_used_at
         FROM system_identity_bindings identity
         LEFT JOIN system_identity_profiles profile ON profile.identity_id = identity.id
         WHERE identity.account_id = ?1
         ORDER BY identity.created_at, identity.id`,
      )
        .bind(accountId)
        .all<IdentityRow>()
      if (!rows.success) return new Error("failed to list System Identities")

      const identities: Array<SystemIdentityCatalogView> = []
      for (const row of rows.results) {
        const identity = this.toView(row)
        if (identity instanceof Error) return identity

        identities.push(identity)
      }

      return Object.freeze(identities)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to list System Identities")
    }
  }

  /** Accountごとに有効なIdentityから優先度が最も高いemailを1件返す。 */
  async primaryEmailsForAccounts(
    accountIds: ReadonlyArray<AccountId>,
  ): Promise<ReadonlyMap<AccountId, string> | Error> {
    const emails = new Map<AccountId, string>()

    try {
      for (let index = 0; index < accountIds.length; index += ACCOUNT_EMAIL_QUERY_CHUNK_SIZE) {
        const chunk = accountIds.slice(index, index + ACCOUNT_EMAIL_QUERY_CHUNK_SIZE)
        const placeholders = chunk.map((_, position) => `?${position + 1}`).join(", ")
        const rows = await this.c.env.DB.prepare(
          `SELECT binding.account_id, profile.email
             FROM system_identity_bindings AS binding
             INNER JOIN system_identity_profiles AS profile ON profile.identity_id = binding.id
            WHERE binding.account_id IN (${placeholders})
              AND binding.activated_at IS NOT NULL
              AND binding.revoked_at IS NULL
              AND profile.email IS NOT NULL
            ORDER BY binding.account_id,
                     profile.email_verified DESC,
                     profile.last_used_at DESC,
                     binding.created_at,
                     binding.id`,
        )
          .bind(...chunk)
          .all<AccountEmailRow>()
        if (!rows.success) return new Error("failed to list System Identity emails")

        for (const row of rows.results) {
          if (!emails.has(row.account_id)) emails.set(row.account_id, row.email)
        }
      }

      return emails
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to list System Identity emails")
    }
  }

  async find(identityId: IdentityId): Promise<SystemIdentityCatalogView | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT identity.id, identity.account_id, identity.provider, identity.subject,
                identity.created_at, identity.activated_at, identity.revoked_at,
                profile.email, profile.email_verified, profile.last_used_at
         FROM system_identity_bindings identity
         LEFT JOIN system_identity_profiles profile ON profile.identity_id = identity.id
         WHERE identity.id = ?1
         LIMIT 1`,
      )
        .bind(identityId)
        .first<IdentityRow>()
      if (row === null) return null

      return this.toView(row)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read System Identity")
    }
  }

  async create(props: CreateProps): Promise<SystemIdentityMutation | Error> {
    if (props.binding.provider === "password" && props.passwordHash === null) return "conflict"
    if (props.binding.provider !== "password" && props.passwordHash !== null) return "conflict"

    try {
      const statements = [
        this.prepareActorAccountGuard(props.actorAccountId, props.binding.accountId),
        this.c.env.DB.prepare(
          `INSERT INTO system_identity_bindings
             (id, account_id, provider, subject, created_at, activated_at, revoked_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, NULL
           WHERE EXISTS (SELECT 1 FROM system_accounts WHERE id = ?2)
             AND (
               ?3 <> 'password'
               OR NOT EXISTS (
                 SELECT 1 FROM system_identity_bindings
                 WHERE account_id = ?2
                   AND provider = 'password'
                   AND revoked_at IS NULL
               )
             )`,
        ).bind(
          props.binding.id,
          props.binding.accountId,
          props.binding.provider,
          props.binding.subject,
          props.binding.createdAt.getTime(),
          props.binding.activatedAt?.getTime() ?? null,
        ),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
        ),
        this.c.env.DB.prepare(
          `INSERT INTO system_identity_profiles
             (identity_id, email, email_verified, last_used_at, updated_at)
           VALUES (?1, ?2, ?3, NULL, ?4)`,
        ).bind(
          props.binding.id,
          props.email,
          props.isEmailVerified ? 1 : 0,
          props.binding.createdAt.getTime(),
        ),
        ...(props.passwordHash === null
          ? []
          : [
              this.c.env.DB.prepare(
                `INSERT INTO system_password_credentials
                   (identity_id, password_hash, changed_at, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?3, ?3)`,
              ).bind(props.binding.id, props.passwordHash, props.binding.createdAt.getTime()),
            ]),
        this.c.env.DB.prepare(
          `UPDATE system_accounts
           SET token_version = token_version + 1,
               updated_at = max(updated_at, ?2)
           WHERE id = ?1 AND token_version < 9007199254740991`,
        ).bind(props.binding.accountId, props.binding.createdAt.getTime()),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
        ),
        ...props.auditStatements,
      ]
      const executions = await this.c.env.DB.batch(statements)
      if (executions.length !== statements.length || executions.some((entry) => !entry.success)) {
        return new Error("System Identity creation batch did not succeed")
      }

      return "created"
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("integer overflow")) {
        return "forbidden"
      }
      if (
        caught instanceof Error &&
        (caught.message.includes("malformed JSON") ||
          caught.message.toLowerCase().includes("unique"))
      ) {
        return "conflict"
      }

      return caught instanceof Error ? caught : new Error("failed to create System Identity")
    }
  }

  async revoke(props: RevokeProps): Promise<SystemIdentityMutation | Error> {
    if (props.identity.binding.state === "revoked") return "not_found"

    try {
      const statements = [
        this.prepareActorAccountGuard(props.actorAccountId, props.identity.binding.accountId),
        ...(props.identity.binding.state === "active"
          ? [this.prepareAdditionalActiveIdentityGuard(props.identity.binding)]
          : []),
        this.c.env.DB.prepare(
          `UPDATE system_identity_bindings
           SET revoked_at = ?2
           WHERE id = ?1 AND revoked_at IS NULL`,
        ).bind(props.identity.binding.id, props.now.getTime()),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
        ),
        this.c.env.DB.prepare(
          "DELETE FROM system_password_credentials WHERE identity_id = ?1",
        ).bind(props.identity.binding.id),
        this.c.env.DB.prepare(
          `UPDATE system_accounts
           SET token_version = token_version + 1,
               updated_at = max(updated_at, ?2)
           WHERE id = ?1 AND token_version < 9007199254740991`,
        ).bind(props.identity.binding.accountId, props.now.getTime()),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
        ),
        this.prepareLastRootGuard(props.identity.binding.accountId),
        ...props.auditStatements,
      ]
      const executions = await this.c.env.DB.batch(statements)
      if (executions.length !== statements.length || executions.some((entry) => !entry.success)) {
        return new Error("System Identity revocation batch did not succeed")
      }

      return "revoked"
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("integer overflow")) {
        return "forbidden"
      }
      if (caught instanceof Error && caught.message.includes("malformed JSON")) {
        const identities = await this.findMany(props.identity.binding.accountId)
        if (identities instanceof Error) return identities
        const activeCount = identities.filter((entry) => entry.binding.state === "active").length
        if (activeCount <= 1) return "last_active_identity"

        return "last_root"
      }

      return caught instanceof Error ? caught : new Error("failed to revoke System Identity")
    }
  }

  private prepareActorAccountGuard(
    actorAccountId: AccountId,
    targetAccountId: AccountId,
  ): D1PreparedStatement {
    return this.c.env.DB.prepare(
      `WITH actor_permissions AS (
         SELECT DISTINCT permission.permission_key AS key
         FROM system_accounts account
         INNER JOIN system_role_bindings binding ON binding.account_id = account.id
         INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
         WHERE account.id = ?1
           AND account.status = 'active'
           AND binding.resource_type IS NULL
           AND binding.revoked_at IS NULL
       ), target_permissions AS (
         SELECT DISTINCT permission.permission_key AS key
         FROM system_role_bindings binding
         INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
         WHERE binding.account_id = ?2 AND binding.revoked_at IS NULL
       )
       SELECT CASE WHEN
         ?1 = ?2
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
    ).bind(actorAccountId, targetAccountId)
  }

  private prepareAdditionalActiveIdentityGuard(
    binding: IdentityBindingEntity,
  ): D1PreparedStatement {
    return this.c.env.DB.prepare(
      `SELECT CASE WHEN EXISTS (
         SELECT 1 FROM system_identity_bindings
         WHERE account_id = ?1
           AND id <> ?2
           AND activated_at IS NOT NULL
           AND revoked_at IS NULL
       ) THEN 1 ELSE json_extract('', '$') END AS ok`,
    ).bind(binding.accountId, binding.id)
  }

  private prepareLastRootGuard(targetAccountId: AccountId): D1PreparedStatement {
    return this.c.env.DB.prepare(
      `SELECT CASE WHEN
         NOT EXISTS (
           SELECT 1
           FROM system_role_bindings binding
           INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
           WHERE binding.account_id = ?1
             AND binding.resource_type IS NULL
             AND binding.revoked_at IS NULL
             AND permission.permission_key = 'system:admin'
         )
         OR EXISTS (
           SELECT 1
           FROM system_accounts account
           INNER JOIN system_identity_bindings identity ON identity.account_id = account.id
           INNER JOIN system_role_bindings binding ON binding.account_id = account.id
           INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
           WHERE account.status = 'active'
             AND identity.activated_at IS NOT NULL
             AND identity.revoked_at IS NULL
             AND binding.resource_type IS NULL
             AND binding.revoked_at IS NULL
             AND permission.permission_key = 'system:admin'
         )
       THEN 1 ELSE json_extract('', '$') END AS ok`,
    ).bind(targetAccountId)
  }

  private toView(row: IdentityRow): SystemIdentityCatalogView | Error {
    const binding = IdentityBindingEntity.create({
      id: row.id,
      accountId: row.account_id,
      provider: row.provider,
      subject: row.subject,
      createdAt: typeof row.created_at === "number" ? new Date(row.created_at) : row.created_at,
      activatedAt:
        row.activated_at === null
          ? null
          : typeof row.activated_at === "number"
            ? new Date(row.activated_at)
            : row.activated_at,
      revokedAt:
        row.revoked_at === null
          ? null
          : typeof row.revoked_at === "number"
            ? new Date(row.revoked_at)
            : row.revoked_at,
    })
    if (binding instanceof Error) return binding
    if (row.email !== null && typeof row.email !== "string") {
      return new Error("System Identity email is invalid")
    }
    if (row.email_verified !== 0 && row.email_verified !== 1) {
      return new Error("System Identity email verification state is invalid")
    }
    if (row.last_used_at !== null && typeof row.last_used_at !== "number") {
      return new Error("System Identity last-use time is invalid")
    }

    return Object.freeze({
      binding,
      email: row.email,
      isEmailVerified: row.email_verified === 1,
      lastUsedAt: row.last_used_at === null ? null : new Date(row.last_used_at),
    })
  }
}
