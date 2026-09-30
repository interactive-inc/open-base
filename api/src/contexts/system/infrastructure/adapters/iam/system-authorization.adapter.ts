import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { IamRoleEntity } from "@system/domain/entities/iam-role.entity"
import { RoleBindingEntity } from "@system/domain/entities/role-binding.entity"
import type { RoleBindingResource } from "@system/domain/schemas/iam/role-binding.schema"
import { systemResourceScopeKey } from "@system/domain/definitions/system-resource-scope-key.definition"
import type { SystemD1Context } from "@system/configuration/system-context"

export type SystemAuthorizationGraph = Readonly<{
  roles: ReadonlyArray<IamRoleEntity>
  bindings: ReadonlyArray<RoleBindingEntity>
}>

export type ResolvedSystemAuthorization = Readonly<{
  permissionKeys: ReadonlySet<string>
  scopedPermissionKeys: ReadonlyMap<string, ReadonlySet<string>>
  roleKeys: ReadonlyArray<string>
}>
type Context = SystemD1Context

// JOIN の中で本人へ絞り、他 Account の付与と permission を materialize しない。
// Account の状態と付与を 1 文で読む。Account が無ければ行は無く、付与が無ければ付与の列が NULL の 1 行を返す。
const accountGrantsSql = `SELECT
  account.status AS account_status,
  grant_row.role_id,
  grant_row.role_key,
  grant_row.role_kind,
  grant_row.role_resource_type,
  grant_row.role_name,
  grant_row.role_created_at,
  grant_row.role_updated_at,
  grant_row.binding_id,
  grant_row.account_id,
  grant_row.resource_type,
  grant_row.resource_id,
  grant_row.binding_created_at,
  grant_row.revoked_at,
  grant_row.permission_key
FROM system_accounts AS account
LEFT JOIN (
  SELECT
    role.id AS role_id,
    role.key AS role_key,
    role.kind AS role_kind,
    role.resource_type AS role_resource_type,
    role.name AS role_name,
    role.created_at AS role_created_at,
    role.updated_at AS role_updated_at,
    binding.id AS binding_id,
    binding.account_id,
    binding.resource_type,
    binding.resource_id,
    binding.created_at AS binding_created_at,
    binding.revoked_at,
    permission.permission_key
  FROM system_role_bindings AS binding
  INNER JOIN system_iam_roles AS role ON role.id = binding.role_id
  LEFT JOIN system_iam_role_permissions AS permission ON permission.role_id = role.id
  WHERE binding.account_id = ?1
) AS grant_row ON grant_row.account_id = account.id
WHERE account.id = ?1
ORDER BY grant_row.role_id, grant_row.permission_key`

export class SystemD1AuthorizationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /**
   * Account の状態と付与を読む 1 文。呼び出し側は自分の読取と同じ batch に入れて往復を減らし、
   * 結果を restoreForAccount で復元できる。
   */
  statementForAccount(accountId: AccountId): D1PreparedStatement {
    return this.c.env.DB.prepare(accountGrantsSql).bind(accountId)
  }

  async loadForAccount(accountId: AccountId): Promise<SystemAuthorizationGraph | null | Error> {
    try {
      const rows = await this.statementForAccount(accountId).all<Record<string, unknown>>()
      return this.restoreForAccount(rows)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve System authorization")
    }
  }

  /** statementForAccount の結果から付与の graph を復元する。 */
  restoreForAccount(
    result: D1Result<Record<string, unknown>> | undefined,
  ): SystemAuthorizationGraph | null | Error {
    try {
      if (result === undefined) return new Error("System IAM authorization rows are missing")
      if (result.results[0]?.account_status !== "active") return null
      const rows = {
        results: result.results.filter((row) => row.binding_id !== null && row.role_id !== null),
      }

      const roleRows = new Map<string, { row: Record<string, unknown>; permissions: Set<string> }>()
      const bindingRows = new Map<string, Record<string, unknown>>()
      for (const row of rows.results) {
        if (typeof row.role_id !== "string" || typeof row.binding_id !== "string") {
          return new Error("System IAM authorization row is invalid")
        }
        const entry = roleRows.get(row.role_id) ?? { row, permissions: new Set<string>() }
        if (typeof row.permission_key === "string") entry.permissions.add(row.permission_key)
        roleRows.set(row.role_id, entry)
        bindingRows.set(row.binding_id, row)
      }

      const roles = [...roleRows.values()].map(({ row, permissions }) =>
        IamRoleEntity.create({
          id: row.role_id,
          key: row.role_key,
          kind: row.role_kind,
          resourceType: row.role_resource_type,
          name: row.role_name,
          permissionKeys: [...permissions].sort(),
          createdAt:
            typeof row.role_created_at === "number"
              ? new Date(row.role_created_at)
              : row.role_created_at,
          updatedAt:
            typeof row.role_updated_at === "number"
              ? new Date(row.role_updated_at)
              : row.role_updated_at,
        }),
      )
      const bindings = [...bindingRows.values()].map((row) =>
        RoleBindingEntity.create({
          id: row.binding_id,
          accountId: row.account_id,
          roleId: row.role_id,
          resource:
            row.resource_type === null && row.resource_id === null
              ? null
              : { type: row.resource_type, id: row.resource_id },
          createdAt:
            typeof row.binding_created_at === "number"
              ? new Date(row.binding_created_at)
              : row.binding_created_at,
          revokedAt:
            row.revoked_at === null
              ? null
              : typeof row.revoked_at === "number"
                ? new Date(row.revoked_at)
                : row.revoked_at,
        }),
      )
      const invalid = [...roles, ...bindings].find((value) => value instanceof Error)
      if (invalid instanceof Error) return invalid

      const restoredRoles = roles as Array<IamRoleEntity>
      const restoredBindings = bindings as Array<RoleBindingEntity>
      const rolesById = new Map(restoredRoles.map((role) => [role.id, role]))
      if (
        restoredBindings.some((binding) => {
          const role = rolesById.get(binding.roleId)
          return !role?.acceptsBindingResource(binding.resource?.type ?? null)
        })
      ) {
        return new Error("System IAM role binding resource is invalid")
      }

      return Object.freeze({
        roles: Object.freeze(restoredRoles),
        bindings: Object.freeze(restoredBindings),
      })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve System authorization")
    }
  }

  async resolveForAccount(command: {
    accountId: AccountId
    resource: RoleBindingResource | null
    at: Date
  }): Promise<ResolvedSystemAuthorization | null | Error> {
    if (!Number.isSafeInteger(command.at.getTime())) {
      return new Error("System authorization time is invalid")
    }
    return this.resolveGraph(await this.loadForAccount(command.accountId), command)
  }

  /** 読み済みの付与の graph から、指定した資源と時点の権限を解決する。 */
  resolveGraph(
    graph: SystemAuthorizationGraph | null | Error,
    command: Readonly<{ resource: RoleBindingResource | null; at: Date }>,
  ): ResolvedSystemAuthorization | null | Error {
    if (!Number.isSafeInteger(command.at.getTime())) {
      return new Error("System authorization time is invalid")
    }
    if (graph === null || graph instanceof Error) return graph

    const rolesById = new Map(graph.roles.map((role) => [role.id, role]))
    const activeBindings = graph.bindings.filter((binding) => binding.isActiveAt(command.at))
    const effectiveRoles = new Map(
      activeBindings.flatMap((binding) => {
        if (!binding.appliesTo(command.resource)) return []
        const role = rolesById.get(binding.roleId)
        return role === undefined ? [] : [[role.id, role] as const]
      }),
    ).values()
    const roles = [...effectiveRoles]
    const scopedPermissionKeys = new Map<string, Set<string>>()
    for (const binding of activeBindings) {
      if (binding.resource === null) continue
      const role = rolesById.get(binding.roleId)
      if (role === undefined) continue
      const key = systemResourceScopeKey(binding.resource)
      const permissions = scopedPermissionKeys.get(key) ?? new Set<string>()
      for (const permission of role.permissionKeys) permissions.add(permission)
      scopedPermissionKeys.set(key, permissions)
    }

    return Object.freeze({
      permissionKeys: new Set(roles.flatMap((role) => role.permissionKeys)),
      scopedPermissionKeys: new Map(
        [...scopedPermissionKeys].map(([key, permissions]) => [key, new Set(permissions)]),
      ),
      roleKeys: Object.freeze(roles.map((role) => role.key).sort()),
    })
  }
}
