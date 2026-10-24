import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { iamRoleIdSchema } from "@system/domain/schemas/iam/iam-role.schema"
import { roleBindingIdSchema } from "@system/domain/schemas/iam/role-binding.schema"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { ReplaceSystemScopedRoleBindingAdapter } from "@system/infrastructure/adapters/iam/replace-system-scoped-role-binding.adapter"
import { RevokeSystemScopedRoleBindingAdapter } from "@system/infrastructure/adapters/iam/revoke-system-scoped-role-binding.adapter"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemRoleBindingRepository } from "@system/infrastructure/repositories/iam/system-role-binding.repository"
import { SystemRoleCatalogRepository } from "@system/infrastructure/repositories/iam/system-role-catalog.repository"

/** 他contextのresource上の単一Account roleを、System履歴を保って置き換える。 */
export async function replaceSystemScopedRoleBinding(
  input: Readonly<{
    database: D1Database
    actorAccountId: string
    targetAccountId: string
    bindingId: string
    roleId: string
    resourceType: string
    resourceId: string
    requiredPermissionKey: string
    managerPermissionKey: string
    now: Date
  }>,
): Promise<"replaced" | "forbidden" | "not_found" | "conflict" | "last_manager" | Error> {
  const actor = zAccountId.safeParse(input.actorAccountId)
  const target = zAccountId.safeParse(input.targetAccountId)
  const bindingId = roleBindingIdSchema.safeParse(input.bindingId)
  const roleId = iamRoleIdSchema.safeParse(input.roleId)
  if (
    !actor.success ||
    !target.success ||
    !bindingId.success ||
    !roleId.success ||
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
  )
    return "forbidden"

  const context = { env: { DB: input.database } }
  const role = await new SystemRoleCatalogRepository(context).find(roleId.data)
  if (role instanceof Error) return role
  if (role === null) return "not_found"
  if (!role.acceptsBindingResource(input.resourceType)) return "conflict"

  const allowed = await RevokeSystemScopedRoleBindingAdapter.canActorManage({
    database: input.database,
    actorAccountId: actor.data,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    requiredPermissionKey: input.requiredPermissionKey,
    targetRoleId: role.id,
  })
  if (allowed instanceof Error) return allowed
  if (!allowed) return "forbidden"

  const allBindings = await new SystemRoleBindingRepository(context).findMany(target.data)
  if (allBindings instanceof Error) return allBindings
  const prior = allBindings.filter(
    (binding) =>
      binding.revokedAt === null &&
      binding.resource?.type === input.resourceType &&
      binding.resource.id === input.resourceId,
  )
  for (const binding of prior) {
    const mayRevoke = await RevokeSystemScopedRoleBindingAdapter.canActorManage({
      database: input.database,
      actorAccountId: actor.data,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      requiredPermissionKey: input.requiredPermissionKey,
      targetRoleId: binding.roleId,
    })
    if (mayRevoke instanceof Error) return mayRevoke
    if (!mayRevoke) return "forbidden"
  }

  const before = StableSystemAuditJsonValue.create(
    prior.map((binding) => ({
      binding_id: binding.id,
      role_id: binding.roleId,
    })),
  )
  const after = StableSystemAuditJsonValue.create({
    account_id: target.data,
    role_id: role.id,
    resource: { type: input.resourceType, id: input.resourceId },
  })
  if (before instanceof Error) return before
  if (after instanceof Error) return after
  const audit = SystemAuditEventEntity.create({
    actorAccountId: actor.data,
    action: SYSTEM_AUDIT_ACTIONS.systemIamRoleBindingReplaced,
    targetType: "system:role-binding",
    targetId: bindingId.data,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: before?.toString() ?? null,
    afterJson: after?.toString() ?? null,
    metadataJson: null,
    occurredAt: input.now,
  })
  if (audit instanceof Error) return audit

  return new ReplaceSystemScopedRoleBindingAdapter({
    database: input.database,
    actorAccountId: actor.data,
    targetAccountId: target.data,
    bindingId: bindingId.data,
    roleId: role.id,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    requiredPermissionKey: input.requiredPermissionKey,
    managerPermissionKey: input.managerPermissionKey,
    now: input.now,
    auditStatements: new SystemAuditEventRepository(context).prepareAppend(audit),
  }).execute()
}
