import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zIdentityId, type IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import type { IdentitySubject } from "@system/domain/schemas/identity/identity-subject.schema"
import {
  roleBindingIdSchema,
  type RoleBindingId,
} from "@system/domain/schemas/iam/role-binding.schema"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import type { SystemD1Context } from "@system/configuration/system-context"

type RootRoleRow = Readonly<{ id: string }>

type CompletedBootstrapRow = Readonly<{
  account_id: string
  identity_id: string
  root_binding_id: string
  email: string
}>

const SYSTEM_ROOT_PERMISSION_KEYS = ["iam:read", "iam:write", "system:admin"] as const

export type SystemRootBootstrapWrite = Readonly<{
  accountId: AccountId
  identityId: IdentityId
  identitySubject: IdentitySubject
  email: string
  passwordHash: string
  rootBindingId: RoleBindingId
  occurredAt: Date
  auditEvent: SystemAuditEventEntity<AccountId>
}>

export type SystemRootBootstrapAdapterResult =
  | Readonly<{
      kind: "created"
      accountId: AccountId
      identityId: IdentityId
      rootBindingId: RoleBindingId
      email: string
    }>
  | Readonly<{
      kind: "already_initialized"
      accountId: AccountId | null
      identityId: IdentityId | null
      rootBindingId: RoleBindingId | null
      email: string | null
      state: "complete" | "account_exists_without_bootstrap_state"
    }>
type Context = SystemD1Context

/** canonical system_* tableだけへroot bootstrapを原子的に保存するD1 adapter。 */
export class D1SystemRootBootstrapAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async bootstrap(
    write: SystemRootBootstrapWrite,
  ): Promise<SystemRootBootstrapAdapterResult | Error> {
    const existing = await this.readExistingState()
    if (existing instanceof Error || existing !== null) return existing ?? new Error("unreachable")

    const accountExists = await this.hasAnyAccount()
    if (accountExists instanceof Error) return accountExists
    if (accountExists) return this.accountExistsWithoutBootstrapState()

    const role = await this.resolveRootRole()
    if (role instanceof Error) return role

    const database = this.c.env.DB
    const statements: D1PreparedStatement[] = []
    if (role.create) {
      statements.push(
        database
          .prepare(
            `INSERT INTO system_iam_roles
               (id, key, kind, name, description, created_at, updated_at)
             VALUES (?1, 'system:root', 'managed', 'System root',
                     'System全体を管理する初期root role', ?2, ?2)`,
          )
          .bind(role.id, write.occurredAt.getTime()),
        ...SYSTEM_ROOT_PERMISSION_KEYS.map((permissionKey) =>
          database
            .prepare(
              `INSERT INTO system_iam_role_permissions (role_id, permission_key)
               VALUES (?1, ?2)`,
            )
            .bind(role.id, permissionKey),
        ),
      )
    }

    statements.push(
      database
        .prepare(
          `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
           SELECT ?1, 'active', 0, ?2, ?2
           WHERE NOT EXISTS (
             SELECT 1 FROM system_accounts WHERE id <> 'system:migration'
           )
             AND NOT EXISTS (SELECT 1 FROM system_bootstrap_state WHERE singleton = 1)`,
        )
        .bind(write.accountId, write.occurredAt.getTime()),
      database.prepare(
        `SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok`,
      ),
      database
        .prepare(
          `INSERT INTO system_principals
             (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
           VALUES (?1, ?2, 'human', ?3, NULL, 1, ?4, ?4)`,
        )
        .bind(crypto.randomUUID(), write.accountId, write.email, write.occurredAt.getTime()),
      database
        .prepare(
          `INSERT INTO system_identity_bindings
             (id, account_id, provider, subject, created_at, activated_at, revoked_at)
           VALUES (?1, ?2, 'password', ?3, ?4, ?4, NULL)`,
        )
        .bind(write.identityId, write.accountId, write.identitySubject, write.occurredAt.getTime()),
      database
        .prepare(
          `INSERT INTO system_identity_profiles
             (identity_id, email, email_verified, last_used_at, updated_at)
           VALUES (?1, ?2, 1, NULL, ?3)`,
        )
        .bind(write.identityId, write.email, write.occurredAt.getTime()),
      database
        .prepare(
          `INSERT INTO system_password_credentials
             (identity_id, password_hash, changed_at, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?3, ?3)`,
        )
        .bind(write.identityId, write.passwordHash, write.occurredAt.getTime()),
      database
        .prepare(
          `INSERT INTO system_role_bindings
             (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
           VALUES (?1, ?2, ?3, NULL, NULL, ?4, NULL)`,
        )
        .bind(write.rootBindingId, write.accountId, role.id, write.occurredAt.getTime()),
      database
        .prepare(
          `INSERT INTO system_bootstrap_state
             (singleton, completed_by_account_id, root_binding_id, completed_at)
           VALUES (1, ?1, ?2, ?3)`,
        )
        .bind(write.accountId, write.rootBindingId, write.occurredAt.getTime()),
      ...new SystemAuditEventRepository(this.c).prepareAppend(write.auditEvent),
    )

    try {
      const results = await database.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("System root bootstrap batch did not succeed")
      }
    } catch (caught) {
      const raced = await this.readExistingState()
      if (raced instanceof Error || raced !== null) {
        return raced ?? new Error("unreachable")
      }
      const racedAccount = await this.hasAnyAccount()
      if (racedAccount instanceof Error) return racedAccount
      if (racedAccount) return this.accountExistsWithoutBootstrapState()

      return caught instanceof Error ? caught : new Error("System root bootstrap failed")
    }

    return Object.freeze({
      kind: "created" as const,
      accountId: write.accountId,
      identityId: write.identityId,
      rootBindingId: write.rootBindingId,
      email: write.email,
    })
  }

  private async resolveRootRole(): Promise<Readonly<{ id: string; create: boolean }> | Error> {
    try {
      const result = await this.c.env.DB.prepare(
        `SELECT role.id
         FROM system_iam_roles role
         INNER JOIN system_iam_role_permissions permission ON permission.role_id = role.id
         WHERE role.kind = 'managed' AND permission.permission_key = 'system:admin'
         ORDER BY CASE WHEN role.key = 'system:root' THEN 0 ELSE 1 END, role.key, role.id
         LIMIT 2`,
      ).all<RootRoleRow>()
      if (!result.success) return new Error("failed to resolve System root role")
      if (result.results.length > 1) return new Error("multiple managed System root roles exist")

      const existing = result.results.at(0)
      return existing === undefined
        ? { id: crypto.randomUUID(), create: true }
        : { id: existing.id, create: false }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve System root role")
    }
  }

  private async readExistingState(): Promise<SystemRootBootstrapAdapterResult | null | Error> {
    try {
      const result = await this.c.env.DB.prepare(
        `SELECT state.completed_by_account_id AS account_id,
                state.root_binding_id AS root_binding_id,
                identity.id AS identity_id,
                profile.email AS email
         FROM system_bootstrap_state state
         INNER JOIN system_identity_bindings identity
           ON identity.account_id = state.completed_by_account_id
          AND identity.provider = 'password'
          AND identity.activated_at IS NOT NULL
          AND identity.revoked_at IS NULL
         INNER JOIN system_identity_profiles profile
           ON profile.identity_id = identity.id
          AND profile.email IS NOT NULL
         WHERE state.singleton = 1
         ORDER BY identity.created_at, identity.id
         LIMIT 2`,
      ).all<CompletedBootstrapRow>()
      if (!result.success) return new Error("failed to read System bootstrap state")
      if (result.results.length === 0) return null
      if (result.results.length !== 1) {
        return new Error("System bootstrap account has multiple active password identities")
      }

      const row = result.results[0]!
      const accountId = zAccountId.safeParse(row.account_id)
      const identityId = zIdentityId.safeParse(row.identity_id)
      const rootBindingId = roleBindingIdSchema.safeParse(row.root_binding_id)
      if (!accountId.success || !identityId.success || !rootBindingId.success) {
        return new Error("System bootstrap state contains invalid identifiers")
      }

      return Object.freeze({
        kind: "already_initialized" as const,
        accountId: accountId.data,
        identityId: identityId.data,
        rootBindingId: rootBindingId.data,
        email: row.email,
        state: "complete" as const,
      })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read System bootstrap state")
    }
  }

  private async hasAnyAccount(): Promise<boolean | Error> {
    try {
      const accountId = await this.c.env.DB.prepare(
        "SELECT id FROM system_accounts WHERE id <> 'system:migration' LIMIT 1",
      ).first<string>("id")
      return accountId !== null
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to read System AccountEntity state")
    }
  }

  private accountExistsWithoutBootstrapState(): SystemRootBootstrapAdapterResult {
    return Object.freeze({
      kind: "already_initialized" as const,
      accountId: null,
      identityId: null,
      rootBindingId: null,
      email: null,
      state: "account_exists_without_bootstrap_state" as const,
    })
  }
}
