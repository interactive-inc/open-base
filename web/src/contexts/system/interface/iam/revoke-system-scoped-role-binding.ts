import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { roleBindingIdSchema } from "@system/domain/schemas/iam/role-binding.schema"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { RevokeSystemScopedRoleBindingAdapter } from "@system/infrastructure/adapters/iam/revoke-system-scoped-role-binding.adapter"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemRoleBindingRepository } from "@system/infrastructure/repositories/iam/system-role-binding.repository"

/** 他contextが所有するresourceのbindingをSystem履歴として失効させる。 */
export async function revokeSystemScopedRoleBinding(
  input: Readonly<{
    database: D1Database
    actorAccountId: string
    targetAccountId: string
    bindingId: string
    resourceType: string
    resourceId: string
    requiredPermissionKey: string
    managerPermissionKey: string
    now: Date
  }>,
): Promise<"revoked" | "already_revoked" | "forbidden" | "not_found" | "last_manager" | Error> {
  const actor = zAccountId.safeParse(input.actorAccountId)
  const target = zAccountId.safeParse(input.targetAccountId)
  const bindingId = roleBindingIdSchema.safeParse(input.bindingId)
  if (
    !actor.success ||
    !target.success ||
    !bindingId.success ||
    actor.data === target.data ||
    !/^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/.test(input.resourceType) ||
    input.resourceType.length > 100 ||
    input.resourceId.length < 1 ||
    input.resourceId.length > 255 ||
    input.requiredPermissionKey.length < 3 ||
    input.requiredPermissionKey.length > 100 ||
    input.managerPermissionKey.length < 3 ||
    input.managerPermissionKey.length > 100 ||
    !Number.isSafeInteger(input.now.getTime())
  ) {
    return "forbidden"
  }

  const allowed = await RevokeSystemScopedRoleBindingAdapter.canActorManage({
    database: input.database,
    actorAccountId: actor.data,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    requiredPermissionKey: input.requiredPermissionKey,
  })
  if (allowed instanceof Error) return allowed
  if (!allowed) return "forbidden"

  const context = { env: { DB: input.database } }
  const binding = await new SystemRoleBindingRepository(context).find(bindingId.data)
  if (binding instanceof Error) return binding
  if (
    binding === null ||
    binding.accountId !== target.data ||
    binding.resource?.type !== input.resourceType ||
    binding.resource.id !== input.resourceId
  ) {
    return "not_found"
  }
  const canRevokeRole = await RevokeSystemScopedRoleBindingAdapter.canActorManage({
    database: input.database,
    actorAccountId: actor.data,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    requiredPermissionKey: input.requiredPermissionKey,
    targetRoleId: binding.roleId,
  })
  if (canRevokeRole instanceof Error) return canRevokeRole
  if (!canRevokeRole) return "forbidden"
  if (binding.revokedAt !== null) return "already_revoked"

  const before = StableSystemAuditJsonValue.create({
    account_id: binding.accountId,
    resource: { type: input.resourceType, id: input.resourceId },
    role_id: binding.roleId,
  })
  if (before instanceof Error) return before
  const audit = SystemAuditEventEntity.create({
    actorAccountId: actor.data,
    action: SYSTEM_AUDIT_ACTIONS.systemIamRoleBindingRevoked,
    targetType: "system:role-binding",
    targetId: binding.id,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: before?.toString() ?? null,
    afterJson: null,
    metadataJson: null,
    occurredAt: input.now,
  })
  if (audit instanceof Error) return audit

  return new RevokeSystemScopedRoleBindingAdapter({
    database: input.database,
    actorAccountId: actor.data,
    targetAccountId: target.data,
    binding,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    requiredPermissionKey: input.requiredPermissionKey,
    managerPermissionKey: input.managerPermissionKey,
    now: input.now,
    auditStatements: new SystemAuditEventRepository(context).prepareAppend(audit),
  }).execute()
}
