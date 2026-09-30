import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { iamRoleIdSchema } from "@system/domain/schemas/iam/iam-role.schema"
import { roleBindingIdSchema } from "@system/domain/schemas/iam/role-binding.schema"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { GrantSystemScopedRoleBindingWithEffectsAdapter } from "@system/infrastructure/adapters/iam/grant-system-scoped-role-binding-with-effects.adapter"
import { RevokeSystemScopedRoleBindingAdapter } from "@system/infrastructure/adapters/iam/revoke-system-scoped-role-binding.adapter"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemRoleBindingRepository } from "@system/infrastructure/repositories/iam/system-role-binding.repository"
import { SystemRoleCatalogRepository } from "@system/infrastructure/repositories/iam/system-role-catalog.repository"

/** 他contextのeffectと同一transactionで、resource上のAccount roleを付与する。 */
export async function grantSystemScopedRoleBindingWithEffects(
  input: Readonly<{
    database: D1Database
    actorAccountId: string
    targetAccountId: string
    bindingId: string
    roleId: string
    resourceType: string
    resourceId: string
    requiredPermissionKey: string
    forbiddenPermissionKey: string
    now: Date
    effects: ReadonlyArray<D1PreparedStatement>
  }>,
): Promise<
  Readonly<{ bindingId: string; created: boolean }> | "forbidden" | "conflict" | "not_found" | Error
> {
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
    input.forbiddenPermissionKey.length < 3 ||
    input.forbiddenPermissionKey.length > 100 ||
    !Number.isSafeInteger(input.now.getTime())
  )
    return "forbidden"

  const context = { env: { DB: input.database } }
  const role = await new SystemRoleCatalogRepository(context).find(roleId.data)
  if (role instanceof Error) return role
  if (role === null) return "not_found"
  if (!role.acceptsBindingResource(input.resourceType)) return "conflict"
  if (role.permissionKeys.includes(input.forbiddenPermissionKey)) return "forbidden"

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

  const all = await new SystemRoleBindingRepository(context).findMany(target.data)
  if (all instanceof Error) return all
  const current = all.filter(
    (binding) =>
      binding.revokedAt === null &&
      binding.resource?.type === input.resourceType &&
      binding.resource.id === input.resourceId,
  )
  if (current.some((binding) => binding.roleId !== role.id) || current.length > 1) return "conflict"
  const existing = current[0] ?? null

  const auditStatements: D1PreparedStatement[] = []
  if (existing === null) {
    const after = StableSystemAuditJsonValue.create({
      account_id: target.data,
      role_id: role.id,
      resource: { type: input.resourceType, id: input.resourceId },
    })
    if (after instanceof Error) return after
    const audit = SystemAuditEventEntity.create({
      actorAccountId: actor.data,
      action: SYSTEM_AUDIT_ACTIONS.systemIamRoleBindingCreated,
      targetType: "system:role-binding",
      targetId: bindingId.data,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: after?.toString() ?? null,
      metadataJson: null,
      occurredAt: input.now,
    })
    if (audit instanceof Error) return audit
    auditStatements.push(...new SystemAuditEventRepository(context).prepareAppend(audit))
  }

  return new GrantSystemScopedRoleBindingWithEffectsAdapter({
    database: input.database,
    actorAccountId: actor.data,
    targetAccountId: target.data,
    bindingId: existing?.id ?? bindingId.data,
    roleId: role.id,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    requiredPermissionKey: input.requiredPermissionKey,
    forbiddenPermissionKey: input.forbiddenPermissionKey,
    now: input.now,
    existing: existing !== null,
    effects: input.effects,
    auditStatements,
  }).execute()
}
