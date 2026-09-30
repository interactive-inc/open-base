import type { SystemD1Context } from "@system/configuration/system-context"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { permissionKeySchema } from "@system/domain/values/iam/permission.value"

type Context = SystemD1Context
type Snapshot = Readonly<{
  principal_id: string
  principal_revision: number
  account_updated_at: number
  grants: string
}>
const authorizedActor = `WITH grants AS (
  SELECT binding.id AS binding_id, binding.role_id, binding.created_at, binding.revoked_at,
    role.updated_at AS role_updated_at, permission.permission_key
  FROM system_role_bindings binding
  JOIN system_iam_roles role ON role.id = binding.role_id
  JOIN system_iam_role_permissions permission ON permission.role_id = role.id
  WHERE binding.account_id = ?1 AND binding.resource_type IS NULL AND binding.resource_id IS NULL
    AND role.resource_type IS NULL AND role.created_at <= ?3 AND binding.created_at <= ?3
    AND (binding.revoked_at IS NULL OR ?3 < binding.revoked_at)
  ORDER BY binding.id, permission.permission_key
)
SELECT principal.id AS principal_id, principal.revision AS principal_revision,
  account.updated_at AS account_updated_at,
  (SELECT json_group_array(json_object('binding', binding_id, 'role', role_id,
    'created', created_at, 'revoked', revoked_at, 'updated', role_updated_at, 'permission', permission_key)) FROM grants) AS grants
FROM system_accounts account JOIN system_principals principal ON principal.account_id = account.id
WHERE account.id = ?1 AND account.status = 'active' AND account.closed_at IS NULL
  AND account.token_version = ?2 AND principal.kind = 'service'
  AND account.created_at <= ?3 AND principal.created_at <= ?3
  AND (EXISTS (SELECT 1 FROM grants WHERE permission_key = 'system:admin')
    OR NOT EXISTS (SELECT 1 FROM json_each(?4) required
      WHERE NOT EXISTS (SELECT 1 FROM grants WHERE permission_key = required.value)))`

/** 登録したServiceの現在のglobal権限を確認し、保存・結果読取のtransactionでも状態と付与元を照合する。 */
export class SystemServiceOperationAuthorizationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      accountId: string
      tokenVersion: number
      permissions: ReadonlyArray<string>
      now: Date
    }>,
  ): Promise<
    | Readonly<{ principalId: string; assertions: ReadonlyArray<D1PreparedStatement> }>
    | "forbidden"
    | Error
  > {
    if (
      !zAccountId.safeParse(input.accountId).success ||
      !Number.isSafeInteger(input.tokenVersion) ||
      input.tokenVersion < 0 ||
      !Number.isSafeInteger(input.now.getTime()) ||
      input.now.getTime() < 0 ||
      input.permissions.length === 0 ||
      input.permissions.length > 100 ||
      input.permissions.some((permission) => !permissionKeySchema.safeParse(permission).success)
    )
      return "forbidden"
    const parameters = [
      input.accountId,
      input.tokenVersion,
      input.now.getTime(),
      JSON.stringify(input.permissions),
    ]
    try {
      const snapshot = await this.c.env.DB.prepare(authorizedActor)
        .bind(...parameters)
        .first<Snapshot>()
      if (snapshot === null) return "forbidden"
      const assertion =
        this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (SELECT 1 FROM (${authorizedActor}) actor
        WHERE actor.principal_id = ?5 AND actor.principal_revision = ?6
          AND actor.account_updated_at = ?7 AND actor.grants = ?8)
        THEN 1 ELSE json_extract('{}', 'system_service_authorization_changed') END AS ok`).bind(
          ...parameters,
          snapshot.principal_id,
          snapshot.principal_revision,
          snapshot.account_updated_at,
          snapshot.grants,
        )
      return { principalId: snapshot.principal_id, assertions: [assertion] }
    } catch (cause) {
      return new Error("service operation authorization is unavailable", { cause })
    }
  }

  static rejected(cause: unknown): boolean {
    const visited = new Set<Error>()
    for (let error = cause; error instanceof Error && !visited.has(error); error = error.cause) {
      if (
        /(?:bad JSON path:|JSON path error near)\s*['"]system_service_authorization_changed['"]/i.test(
          error.message,
        )
      )
        return true
      visited.add(error)
    }
    return false
  }
}
