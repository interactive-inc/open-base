import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { IamRoleEntity } from "@system/domain/entities/iam-role.entity"
import { RoleBindingEntity } from "@system/domain/entities/role-binding.entity"
import type { RoleBindingId } from "@system/domain/schemas/iam/role-binding.schema"
import type { SystemD1Context } from "@system/configuration/system-context"

type BindingRow = Readonly<{
  id: unknown
  account_id: unknown
  role_id: unknown
  resource_type: unknown
  resource_id: unknown
  created_at: unknown
  revoked_at: unknown
}>

export type SystemRoleBindingMutation =
  | "created"
  | "revoked"
  | "not_found"
  | "conflict"
  | "forbidden"
  | "last_root"
type Context = SystemD1Context

/** System AccountとRoleのglobalまたはopaque resource bindingを原子的に保存する。 */
export class SystemRoleBindingRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany(accountId: AccountId): Promise<ReadonlyArray<RoleBindingEntity> | Error> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT id, account_id, role_id, resource_type, resource_id, created_at, revoked_at
         FROM system_role_bindings
         WHERE account_id = ?1
         ORDER BY created_at, id`,
      )
        .bind(accountId)
        .all<BindingRow>()
      if (!rows.success) return new Error("failed to list System role bindings")

      const bindings: Array<RoleBindingEntity> = []
      for (const row of rows.results) {
        const binding = this.toBinding(row)
        if (binding instanceof Error) return binding

        bindings.push(binding)
      }

      return Object.freeze(bindings)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to list System role bindings")
    }
  }

  async find(bindingId: RoleBindingId): Promise<RoleBindingEntity | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT id, account_id, role_id, resource_type, resource_id, created_at, revoked_at
         FROM system_role_bindings
         WHERE id = ?1
         LIMIT 1`,
      )
        .bind(bindingId)
        .first<BindingRow>()
      if (row === null) return null

      return this.toBinding(row)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read System role binding")
    }
  }

  async create(
    actorAccountId: AccountId,
    role: IamRoleEntity,
    binding: RoleBindingEntity,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<SystemRoleBindingMutation | Error> {
    if (actorAccountId === binding.accountId) return "forbidden"
    if (!role.acceptsBindingResource(binding.resource?.type ?? null)) return "conflict"

    try {
      const statements = [
        this.prepareActorRoleGuard(actorAccountId, role.permissionKeys),
        this.c.env.DB.prepare(
          `INSERT INTO system_role_bindings
             (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, NULL
           WHERE EXISTS (SELECT 1 FROM system_accounts WHERE id = ?2)`,
        ).bind(
          binding.id,
          binding.accountId,
          binding.roleId,
          binding.resource?.type ?? null,
          binding.resource?.id ?? null,
          binding.createdAt.getTime(),
        ),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
        ),
        this.c.env.DB.prepare(
          `UPDATE system_accounts
           SET token_version = token_version + 1,
               updated_at = max(updated_at, ?2)
           WHERE id = ?1 AND token_version < 9007199254740991`,
        ).bind(binding.accountId, binding.createdAt.getTime()),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
        ),
        ...auditStatements,
      ]
      const executions = await this.c.env.DB.batch(statements)
      if (executions.length !== statements.length || executions.some((entry) => !entry.success)) {
        return new Error("System role binding creation batch did not succeed")
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

      return caught instanceof Error ? caught : new Error("failed to create System role binding")
    }
  }

  async revoke(
    actorAccountId: AccountId,
    role: IamRoleEntity,
    binding: RoleBindingEntity,
    now: Date,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<SystemRoleBindingMutation | Error> {
    if (binding.revokedAt !== null) return "not_found"
    // 自分のbindingのrevokeは常に特権を失う方向なので、root残存数によらず拒否する。
    // createの自己付与拒否およびsetStatusの自己無効化拒否と判定順を揃える。
    if (actorAccountId === binding.accountId) return "forbidden"

    try {
      const statements = [
        this.prepareActorRoleGuard(actorAccountId, role.permissionKeys),
        this.c.env.DB.prepare(
          `UPDATE system_role_bindings
           SET revoked_at = ?2
           WHERE id = ?1 AND revoked_at IS NULL AND created_at <= ?2`,
        ).bind(binding.id, now.getTime()),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
        ),
        this.c.env.DB.prepare(
          `UPDATE system_accounts
           SET token_version = token_version + 1,
               updated_at = max(updated_at, ?2)
           WHERE id = ?1 AND token_version < 9007199254740991`,
        ).bind(binding.accountId, now.getTime()),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
        ),
        this.prepareLastRootGuard(),
        ...auditStatements,
      ]
      const executions = await this.c.env.DB.batch(statements)
      if (executions.length !== statements.length || executions.some((entry) => !entry.success)) {
        return new Error("System role binding revocation batch did not succeed")
      }

      return "revoked"
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("integer overflow")) {
        return "forbidden"
      }
      if (caught instanceof Error && caught.message.includes("malformed JSON")) {
        const current = await this.find(binding.id)
        if (
          current === null ||
          (current instanceof RoleBindingEntity && current.revokedAt !== null)
        ) {
          return "not_found"
        }

        return "last_root"
      }

      return caught instanceof Error ? caught : new Error("failed to revoke System role binding")
    }
  }

  private prepareActorRoleGuard(
    actorAccountId: AccountId,
    permissionKeys: ReadonlyArray<string>,
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
       )
       SELECT CASE WHEN
         EXISTS (SELECT 1 FROM actor_permissions WHERE key = 'system:admin')
         OR (
           EXISTS (SELECT 1 FROM actor_permissions WHERE key = 'iam:write')
           AND NOT EXISTS (
             SELECT 1 FROM json_each(?2) required_permission
             WHERE NOT EXISTS (
               SELECT 1 FROM actor_permissions actor
               WHERE actor.key = CAST(required_permission.value AS TEXT)
             )
           )
         )
       THEN 1 ELSE abs(-9223372036854775808) END AS ok`,
    ).bind(actorAccountId, JSON.stringify(permissionKeys))
  }

  private prepareLastRootGuard(): D1PreparedStatement {
    return this.c.env.DB.prepare(
      `SELECT CASE WHEN EXISTS (
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
       ) THEN 1 ELSE json_extract('', '$') END AS ok`,
    )
  }

  private toBinding(row: BindingRow): RoleBindingEntity | Error {
    if (
      (row.resource_type === null) !== (row.resource_id === null) ||
      (row.resource_type !== null && typeof row.resource_type !== "string") ||
      (row.resource_id !== null && typeof row.resource_id !== "string")
    ) {
      return new Error("System role binding resource is invalid")
    }

    return RoleBindingEntity.create({
      id: row.id,
      accountId: row.account_id,
      roleId: row.role_id,
      resource:
        row.resource_type === null || row.resource_id === null
          ? null
          : { type: row.resource_type, id: row.resource_id },
      createdAt: typeof row.created_at === "number" ? new Date(row.created_at) : row.created_at,
      revokedAt:
        row.revoked_at === null
          ? null
          : typeof row.revoked_at === "number"
            ? new Date(row.revoked_at)
            : row.revoked_at,
    })
  }
}
