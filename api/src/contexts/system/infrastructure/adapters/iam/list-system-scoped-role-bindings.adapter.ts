import { RoleBindingEntity } from "@system/domain/entities/role-binding.entity"
import type { SystemScopedRoleBinding } from "@system/domain/definitions/system-iam-read-models.definition"

type Context = D1Database

type Row = Readonly<{
  id: unknown
  account_id: unknown
  role_id: unknown
  resource_type: unknown
  resource_id: unknown
  created_at: unknown
  permission_key: unknown
}>

/** Systemのbinding/role表を、他context用の安定した読み取り結果へ変換する。 */
export class ListSystemScopedRoleBindingsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async list(
    input: Readonly<{
      resourceType: string
      resourceId: string
      accountId?: string
      at: Date
    }>,
  ): Promise<ReadonlyArray<SystemScopedRoleBinding> | Error> {
    try {
      const result = await this.c
        .prepare(
          `SELECT binding.id, binding.account_id, binding.role_id,
                binding.resource_type, binding.resource_id, binding.created_at,
                permission.permission_key
         FROM system_role_bindings binding
         LEFT JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
         WHERE binding.resource_type = ?1 AND binding.resource_id = ?2
           AND binding.revoked_at IS NULL AND binding.created_at <= ?3
           AND (?4 IS NULL OR binding.account_id = ?4)
         ORDER BY binding.created_at, binding.id, permission.permission_key`,
        )
        .bind(input.resourceType, input.resourceId, input.at.getTime(), input.accountId ?? null)
        .all<Row>()
      if (!result.success) return new Error("failed to list System scoped role bindings")

      const values = new Map<string, { binding: RoleBindingEntity; permissionKeys: Set<string> }>()
      for (const row of result.results) {
        const binding = RoleBindingEntity.create({
          id: row.id,
          accountId: row.account_id,
          roleId: row.role_id,
          resource: { type: row.resource_type, id: row.resource_id },
          createdAt: typeof row.created_at === "number" ? new Date(row.created_at) : row.created_at,
          revokedAt: null,
        })
        if (binding instanceof Error) return binding
        const existing = values.get(binding.id)
        if (
          existing !== undefined &&
          (existing.binding.accountId !== binding.accountId ||
            existing.binding.roleId !== binding.roleId ||
            existing.binding.resource?.type !== binding.resource?.type ||
            existing.binding.resource?.id !== binding.resource?.id)
        )
          return new Error("inconsistent System role binding rows")
        const entry = existing ?? { binding, permissionKeys: new Set<string>() }
        if (row.permission_key !== null) {
          if (typeof row.permission_key !== "string")
            return new Error("invalid System role permission")
          entry.permissionKeys.add(row.permission_key)
        }
        values.set(binding.id, entry)
      }

      return Object.freeze(
        [...values.values()].map(({ binding, permissionKeys }) =>
          Object.freeze({
            id: binding.id,
            accountId: binding.accountId,
            roleId: binding.roleId,
            resourceId: binding.resource?.id ?? input.resourceId,
            createdAt: binding.createdAt,
            permissionKeys: Object.freeze([...permissionKeys].sort()),
          }),
        ),
      )
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to list System scoped role bindings")
    }
  }
}
