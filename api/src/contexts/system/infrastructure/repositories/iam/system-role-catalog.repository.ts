import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { IamRoleEntity } from "@system/domain/entities/iam-role.entity"
import type { IamRoleId } from "@system/domain/schemas/iam/iam-role.schema"
import type { SystemD1Context } from "@system/configuration/system-context"

type RoleRow = Readonly<{
  id: unknown
  key: unknown
  kind: unknown
  resource_type: unknown
  name: unknown
  description: unknown
  permission_key: unknown
  created_at: unknown
  updated_at: unknown
}>

type RoleParts = Readonly<{
  row: RoleRow
  permissionKeys: Set<string>
}>

export type SystemRoleMutation =
  | "created"
  | "updated"
  | "deleted"
  | "not_found"
  | "conflict"
  | "forbidden"
  | "managed_role"
  | "role_in_use"
type Context = SystemD1Context

/** namespaced permissionを束ねるSystem Roleを、割当と同じ正本へ保存する。 */
export class SystemRoleCatalogRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany(): Promise<ReadonlyArray<IamRoleEntity> | Error> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT role.id, role.key, role.kind, role.resource_type, role.name, role.description,
                role.created_at, role.updated_at, permission.permission_key
         FROM system_iam_roles role
         LEFT JOIN system_iam_role_permissions permission ON permission.role_id = role.id
         ORDER BY role.key, role.id, permission.permission_key`,
      ).all<RoleRow>()
      if (!rows.success) return new Error("failed to list System IAM roles")

      return this.toRoles(rows.results)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to list System IAM roles")
    }
  }

  async find(roleId: IamRoleId): Promise<IamRoleEntity | null | Error> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT role.id, role.key, role.kind, role.resource_type, role.name, role.description,
                role.created_at, role.updated_at, permission.permission_key
         FROM system_iam_roles role
         LEFT JOIN system_iam_role_permissions permission ON permission.role_id = role.id
         WHERE role.id = ?1
         ORDER BY permission.permission_key`,
      )
        .bind(roleId)
        .all<RoleRow>()
      if (!rows.success) return new Error("failed to read System IAM role")
      if (rows.results.length === 0) return null

      const roles = this.toRoles(rows.results)
      if (roles instanceof Error) return roles

      return roles[0] ?? null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read System IAM role")
    }
  }

  async create(
    actorAccountId: AccountId,
    role: IamRoleEntity,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<SystemRoleMutation | Error> {
    try {
      const statements = [
        this.prepareActorRoleGuard(actorAccountId, role.permissionKeys),
        this.c.env.DB.prepare(
          `INSERT INTO system_iam_roles
             (id, key, kind, resource_type, name, description, created_at, updated_at)
           VALUES (?1, ?2, 'custom', ?3, ?4, ?5, ?6, ?6)`,
        ).bind(
          role.id,
          role.key,
          role.resourceType,
          role.name,
          role.description,
          role.createdAt.getTime(),
        ),
        ...role.permissionKeys.map((permissionKey) =>
          this.c.env.DB.prepare(
            `INSERT INTO system_iam_role_permissions (role_id, permission_key)
             VALUES (?1, ?2)`,
          ).bind(role.id, permissionKey),
        ),
        ...auditStatements,
      ]
      const executions = await this.c.env.DB.batch(statements)
      if (executions.length !== statements.length || executions.some((entry) => !entry.success)) {
        return new Error("System IAM role creation batch did not succeed")
      }

      return "created"
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("integer overflow")) {
        return "forbidden"
      }
      if (caught instanceof Error && caught.message.toLowerCase().includes("unique")) {
        return "conflict"
      }

      return caught instanceof Error ? caught : new Error("failed to create System IAM role")
    }
  }

  async update(
    actorAccountId: AccountId,
    previous: IamRoleEntity,
    next: IamRoleEntity,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<SystemRoleMutation | Error> {
    if (previous.kind === "managed") return "managed_role"

    try {
      const statements = [
        this.prepareActorRoleGuard(actorAccountId, next.permissionKeys),
        this.c.env.DB.prepare(
          `UPDATE system_iam_roles
           SET name = ?2, description = ?3, updated_at = ?4
           WHERE id = ?1 AND kind = 'custom' AND updated_at = ?5`,
        ).bind(
          previous.id,
          next.name,
          next.description,
          next.updatedAt.getTime(),
          previous.updatedAt.getTime(),
        ),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE abs(-9223372036854775808) END AS ok",
        ),
        this.c.env.DB.prepare("DELETE FROM system_iam_role_permissions WHERE role_id = ?1").bind(
          previous.id,
        ),
        ...next.permissionKeys.map((permissionKey) =>
          this.c.env.DB.prepare(
            `INSERT INTO system_iam_role_permissions (role_id, permission_key)
             VALUES (?1, ?2)`,
          ).bind(previous.id, permissionKey),
        ),
        this.c.env.DB.prepare(
          `UPDATE system_accounts
           SET token_version = token_version + 1,
               updated_at = max(updated_at, ?2)
           WHERE id IN (
             SELECT account_id FROM system_role_bindings
             WHERE role_id = ?1 AND revoked_at IS NULL
           )
             AND token_version < 9007199254740991`,
        ).bind(previous.id, next.updatedAt.getTime()),
        this.prepareAssignedAccountTokenGuard(previous.id),
        this.prepareLastRootGuard(),
        ...auditStatements,
      ]
      const executions = await this.c.env.DB.batch(statements)
      if (executions.length !== statements.length || executions.some((entry) => !entry.success)) {
        return new Error("System IAM role update batch did not succeed")
      }

      return "updated"
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("integer overflow")) {
        return "forbidden"
      }
      if (caught instanceof Error && caught.message.includes("malformed JSON")) {
        return "conflict"
      }

      return caught instanceof Error ? caught : new Error("failed to update System IAM role")
    }
  }

  async delete(
    actorAccountId: AccountId,
    role: IamRoleEntity,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<SystemRoleMutation | Error> {
    if (role.kind === "managed") return "managed_role"

    try {
      const statements = [
        this.prepareActorRoleGuard(actorAccountId, role.permissionKeys),
        this.c.env.DB.prepare(
          `SELECT CASE WHEN EXISTS (
             SELECT 1 FROM system_role_bindings
             WHERE role_id = ?1 AND revoked_at IS NULL
           ) THEN json_extract('', '$') ELSE 1 END AS ok`,
        ).bind(role.id),
        this.c.env.DB.prepare("DELETE FROM system_iam_role_permissions WHERE role_id = ?1").bind(
          role.id,
        ),
        this.c.env.DB.prepare(
          "DELETE FROM system_iam_roles WHERE id = ?1 AND kind = 'custom'",
        ).bind(role.id),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE abs(-9223372036854775808) END AS ok",
        ),
        ...auditStatements,
      ]
      const executions = await this.c.env.DB.batch(statements)
      if (executions.length !== statements.length || executions.some((entry) => !entry.success)) {
        return new Error("System IAM role deletion batch did not succeed")
      }

      return "deleted"
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("integer overflow")) {
        return "forbidden"
      }
      if (caught instanceof Error && caught.message.includes("malformed JSON")) {
        return "role_in_use"
      }

      return caught instanceof Error ? caught : new Error("failed to delete System IAM role")
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

  private prepareAssignedAccountTokenGuard(roleId: IamRoleId): D1PreparedStatement {
    return this.c.env.DB.prepare(
      `SELECT CASE WHEN NOT EXISTS (
         SELECT 1
         FROM system_role_bindings binding
         INNER JOIN system_accounts account ON account.id = binding.account_id
         WHERE binding.role_id = ?1
           AND binding.revoked_at IS NULL
           AND account.token_version >= 9007199254740991
       ) THEN 1 ELSE abs(-9223372036854775808) END AS ok`,
    ).bind(roleId)
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

  private toRoles(rows: ReadonlyArray<RoleRow>): ReadonlyArray<IamRoleEntity> | Error {
    const partsById = new Map<string, RoleParts>()
    for (const row of rows) {
      if (typeof row.id !== "string") return new Error("System IAM role identifier is invalid")

      const existing = partsById.get(row.id)
      const parts = existing ?? { row, permissionKeys: new Set<string>() }
      if (typeof row.permission_key === "string") parts.permissionKeys.add(row.permission_key)
      partsById.set(row.id, parts)
    }

    const roles: Array<IamRoleEntity> = []
    for (const parts of partsById.values()) {
      const role = IamRoleEntity.create({
        id: parts.row.id,
        key: parts.row.key,
        kind: parts.row.kind,
        resourceType: parts.row.resource_type,
        name: parts.row.name,
        description: parts.row.description,
        permissionKeys: [...parts.permissionKeys].sort(),
        createdAt:
          typeof parts.row.created_at === "number"
            ? new Date(parts.row.created_at)
            : parts.row.created_at,
        updatedAt:
          typeof parts.row.updated_at === "number"
            ? new Date(parts.row.updated_at)
            : parts.row.updated_at,
      })
      if (role instanceof Error) return role

      roles.push(role)
    }

    return Object.freeze(roles)
  }
}
