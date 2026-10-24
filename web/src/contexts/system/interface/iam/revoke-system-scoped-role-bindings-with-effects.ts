import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { RevokeSystemScopedRoleBindingAdapter } from "@system/infrastructure/adapters/iam/revoke-system-scoped-role-binding.adapter"
import { RevokeSystemScopedRoleBindingsWithEffectsAdapter } from "@system/infrastructure/adapters/iam/revoke-system-scoped-role-bindings-with-effects.adapter"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemRoleBindingRepository } from "@system/infrastructure/repositories/iam/system-role-binding.repository"

/** 他contextの変更と同一transactionで、resource上のAccount roleをすべて失効する。 */
export async function revokeSystemScopedRoleBindingsWithEffects(
  input: Readonly<{
    database: D1Database
    actorAccountId: string
    targetAccountId: string
    resourceType: string
    resourceId: string
    requiredPermissionKey: string
    managerPermissionKey: string
    invitationRelatedResourceIds?: ReadonlyArray<string>
    now: Date
    effects: ReadonlyArray<D1PreparedStatement>
  }>,
): Promise<"revoked" | "forbidden" | "conflict" | "last_manager" | Error> {
  const actor = zAccountId.safeParse(input.actorAccountId)
  const target = zAccountId.safeParse(input.targetAccountId)
  const relatedResourceIds = [...new Set(input.invitationRelatedResourceIds ?? [])]
  if (
    !actor.success ||
    !target.success ||
    !/^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/.test(input.resourceType) ||
    input.resourceType.length > 100 ||
    input.resourceId.length < 1 ||
    input.resourceId.length > 255 ||
    input.requiredPermissionKey.length < 3 ||
    input.requiredPermissionKey.length > 100 ||
    input.managerPermissionKey.length < 3 ||
    input.managerPermissionKey.length > 100 ||
    !Number.isSafeInteger(input.now.getTime()) ||
    relatedResourceIds.length > 500 ||
    relatedResourceIds.some((id) => id.length < 1 || id.length > 255)
  )
    return "forbidden"

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
  const all = await new SystemRoleBindingRepository(context).findMany(target.data)
  if (all instanceof Error) return all
  const bindings = all.filter(
    (binding) =>
      binding.revokedAt === null &&
      binding.resource?.type === input.resourceType &&
      binding.resource.id === input.resourceId,
  )
  if (bindings.length > 0 && actor.data === target.data) return "forbidden"

  const auditRepository = new SystemAuditEventRepository(context)
  const auditStatements: D1PreparedStatement[] = []
  for (const binding of bindings) {
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

    const before = StableSystemAuditJsonValue.create({
      account_id: target.data,
      role_id: binding.roleId,
      resource: { type: input.resourceType, id: input.resourceId },
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
    auditStatements.push(...auditRepository.prepareAppend(audit))
  }

  const invitationIds: string[] = []
  const invitationAuditStatements: D1PreparedStatement[] = []
  if (relatedResourceIds.length > 0) {
    let invitations: D1Result<{ id: string; role_id: string }>
    try {
      invitations = await input.database
        .prepare(
          `SELECT id, role_id FROM system_account_invitations
           WHERE resource_type = ?1 AND resource_id = ?2
             AND related_resource_id IN (SELECT value FROM json_each(?3))
             AND accepted_by_account_id IS NULL AND revoked_at IS NULL
             AND expires_at > ?4 AND created_at <= ?4
           ORDER BY id`,
        )
        .bind(
          input.resourceType,
          input.resourceId,
          JSON.stringify(relatedResourceIds),
          input.now.getTime(),
        )
        .all<{ id: string; role_id: string }>()
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("System invitation lookup failed")
    }
    if (!invitations.success) return new Error("System invitation lookup did not succeed")
    for (const invitation of invitations.results) {
      const mayRevoke = await RevokeSystemScopedRoleBindingAdapter.canActorManage({
        database: input.database,
        actorAccountId: actor.data,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        requiredPermissionKey: input.requiredPermissionKey,
        targetRoleId: invitation.role_id,
      })
      if (mayRevoke instanceof Error) return mayRevoke
      if (!mayRevoke) return "forbidden"
      invitationIds.push(invitation.id)
      const before = StableSystemAuditJsonValue.create({
        role_id: invitation.role_id,
        resource: { type: input.resourceType, id: input.resourceId },
      })
      if (before instanceof Error) return before
      const audit = SystemAuditEventEntity.create({
        actorAccountId: actor.data,
        action: SYSTEM_AUDIT_ACTIONS.systemAccountInvitationRevoked,
        targetType: "system:account-invitation",
        targetId: invitation.id,
        outcome: "succeeded",
        reasonCode: null,
        authorizationJson: null,
        beforeJson: before?.toString() ?? null,
        afterJson: null,
        metadataJson: null,
        occurredAt: input.now,
      })
      if (audit instanceof Error) return audit
      invitationAuditStatements.push(...auditRepository.prepareAppend(audit))
    }
  }

  return new RevokeSystemScopedRoleBindingsWithEffectsAdapter({
    database: input.database,
    actorAccountId: actor.data,
    targetAccountId: target.data,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    requiredPermissionKey: input.requiredPermissionKey,
    managerPermissionKey: input.managerPermissionKey,
    bindingIds: bindings.map((binding) => binding.id),
    invitationRelatedResourceIds: relatedResourceIds,
    invitationIds,
    now: input.now,
    effects: input.effects,
    auditStatements,
    invitationAuditStatements,
  }).execute()
}
