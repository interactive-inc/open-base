import type { IamRoleEntity } from "@system/domain/entities/iam-role.entity"
import type { RoleBindingResource } from "@system/domain/schemas/iam/role-binding.schema"
import type {
  SystemAuthorizationContext,
  SystemD1Context,
} from "@system/configuration/system-context"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"

/** Systemの変更を現在のBearer・対象資源の権限・利用済み再認証grantへ束縛する。 */
export async function prepareSystemWriteAuthorization(
  context: SystemD1Context & SystemAuthorizationContext,
  input: Readonly<{
    now: Date
    stepUpToken: string
    requiredPermissions: ReadonlyArray<string>
    resource?: RoleBindingResource | null
    afterRoleRevision?: IamRoleEntity
    principalRename?: Readonly<{ principalId: string; revision: number; updatedAtMs: number }>
  }>,
): Promise<ReadonlyArray<D1PreparedStatement> | "forbidden" | Error> {
  const authentication = context.var.bearerReadAuthentication
  if (
    (input.afterRoleRevision !== undefined && input.principalRename !== undefined) ||
    authentication === undefined ||
    authentication.accountId !== context.var.userId ||
    authentication.tokenVersion !== context.var.accountTokenVersion ||
    !/^[0-9a-f]{64}$/.test(input.stepUpToken) ||
    input.requiredPermissions.length === 0 ||
    input.requiredPermissions.length > 100
  )
    return "forbidden"
  const now = new Date(Math.max(input.now.getTime(), Date.now()))
  const proof = await new PrepareSystemReadAuthorizationAdapter(context).prepare(
    authentication,
    now,
    input.afterRoleRevision,
  )
  if (proof === null || PrepareSystemReadAuthorizationAdapter.isRejected(proof)) return "forbidden"
  if (proof instanceof Error) return proof
  if (
    input.requiredPermissions.some(
      (permission) =>
        !authorizeSystemOperation(proof.permissionKeys, permission, now, {
          scopedPermissionKeys: proof.scopedPermissionKeys,
          resource: input.resource ?? null,
        }),
    )
  )
    return "forbidden"
  const assertions = proof.assertions(now, input.principalRename)
  if (assertions instanceof Error) return assertions
  const hash = await new SystemPrincipalSecretService().hashRawSecret(input.stepUpToken)
  if (hash instanceof Error) return hash
  return [
    ...assertions,
    context.env.DB.prepare(`WITH evaluation AS (
    SELECT max(?3, CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AS at
  ) SELECT CASE WHEN EXISTS (
    SELECT 1 FROM system_step_up_grants WHERE account_id=?1 AND token_hash=?2
      AND issued_at <= (SELECT at FROM evaluation) AND expires_at > (SELECT at FROM evaluation)
      AND revoked_at IS NULL AND last_used_at IS NOT NULL AND last_used_at <= (SELECT at FROM evaluation)
  ) THEN 1 ELSE json_extract('{}','system_read_authorization_changed') END`).bind(
      authentication.accountId,
      hash,
      now.getTime(),
    ),
  ]
}
