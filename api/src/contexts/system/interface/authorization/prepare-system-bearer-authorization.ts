import type { IamRoleEntity } from "@system/domain/entities/iam-role.entity"
import type { RoleBindingResource } from "@system/domain/schemas/iam/role-binding.schema"
import type {
  SystemAuthorizationContext,
  SystemD1Context,
} from "@system/configuration/system-context"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"

/** 現在のBearer発行元とcanonicalな対象資源の権限を、保存・開示境界で固定する。 */
export async function prepareSystemBearerAuthorization(
  context: SystemD1Context & SystemAuthorizationContext,
  input: Readonly<{
    now: Date
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
  return assertions
}
