import type { SystemD1Context } from "@system/configuration/system-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAccessTokenStateAdapter } from "@system/infrastructure/adapters/auth/system-access-token-state.adapter"
import { SystemD1AuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-authorization.adapter"
import { roleBindingResourceSchema } from "@system/domain/schemas/iam/role-binding.schema"
import { permissionKeySchema } from "@system/domain/values/iam/permission.value"

export type SystemMachineOperationActor = Readonly<{
  accountId: AccountId
  tokenVersion: number
  credentialId: string
  issuedAtMs: number
}>

type Context = SystemD1Context

/** 機械主体と対象scopeの現在の許可を確認し、変更のtransactionで同じ条件を再検査する。 */
export class SystemMachineOperationAuthorizationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      actor: SystemMachineOperationActor
      resource: Readonly<{ type: string; id: string }>
      permissions: ReadonlyArray<string>
      now: Date
    }>,
  ): Promise<ReadonlyArray<D1PreparedStatement> | "forbidden" | Error> {
    if (
      !roleBindingResourceSchema.safeParse(input.resource).success ||
      input.permissions.length === 0 ||
      input.permissions.length > 100 ||
      input.permissions.some((permission) => !permissionKeySchema.safeParse(permission).success)
    ) {
      return "forbidden"
    }
    const state = await new SystemAccessTokenStateAdapter({ database: this.c.env.DB }).resolve({
      accountId: input.actor.accountId,
      tokenVersion: input.actor.tokenVersion,
      issuedAtMs: input.actor.issuedAtMs,
      machineCredentialId: input.actor.credentialId,
      at: input.now,
    })
    if (state instanceof Error) return state
    if (state.kind === "rejected" || state.machine === null) return "forbidden"
    const authorization = await new SystemD1AuthorizationAdapter(this.c).resolveForAccount({
      accountId: input.actor.accountId,
      resource: input.resource,
      at: input.now,
    })
    if (authorization instanceof Error) return authorization
    if (
      authorization === null ||
      (!authorization.permissionKeys.has("system:admin") &&
        input.permissions.some((permission) => !authorization.permissionKeys.has(permission)))
    )
      return "forbidden"
    return [
      this.c.env.DB.prepare(`WITH actor_permissions AS (
      SELECT DISTINCT permission.permission_key AS key
      FROM system_role_bindings binding
      JOIN system_iam_roles role ON role.id = binding.role_id
      JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
      WHERE binding.account_id = ?1 AND binding.created_at <= ?5 AND binding.revoked_at IS NULL
        AND role.resource_type IS binding.resource_type
        AND (binding.resource_type IS NULL OR (binding.resource_type = ?6 AND binding.resource_id = ?7))
    )
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM system_accounts account
      JOIN system_principals principal ON principal.account_id = account.id
      JOIN system_machine_credentials credential ON credential.principal_id = principal.id
      LEFT JOIN system_connectors connector ON connector.id = principal.connector_id
      WHERE account.id = ?1 AND account.status = 'active' AND account.token_version = ?2
        AND credential.id = ?3 AND credential.status = 'active'
        AND credential.created_at <= ?4 AND credential.created_at <= ?5
        AND credential.last_used_at >= ?4
        AND (credential.expires_at IS NULL OR (credential.expires_at > ?4 AND credential.expires_at > ?5))
        AND principal.kind IN ('agent', 'service', 'connector')
        AND (principal.kind <> 'connector' OR connector.status = 'active')
    ) AND (
      EXISTS (SELECT 1 FROM actor_permissions WHERE key = 'system:admin')
      OR NOT EXISTS (
        SELECT 1 FROM json_each(?8) required
        WHERE NOT EXISTS (SELECT 1 FROM actor_permissions WHERE key = required.value)
      )
    ) THEN 1 ELSE json_extract('', '$') END AS ok`).bind(
        input.actor.accountId,
        input.actor.tokenVersion,
        input.actor.credentialId,
        input.actor.issuedAtMs,
        input.now.getTime(),
        input.resource.type,
        input.resource.id,
        JSON.stringify(input.permissions),
      ),
    ]
  }
}
