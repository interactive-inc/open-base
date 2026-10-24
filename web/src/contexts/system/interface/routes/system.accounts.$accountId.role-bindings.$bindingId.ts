import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import {
  SystemForbiddenError,
  SystemIAMUnavailableError,
  SystemInvalidSessionError,
  SystemLastRootBindingError,
  SystemRoleBindingNotFoundError,
} from "@system/interface/errors"
/** /system/accounts/:accountId/role-bindings/:bindingId */
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { roleBindingIdSchema } from "@system/domain/schemas/iam/role-binding.schema"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemRoleCatalogRepository } from "@system/infrastructure/repositories/iam/system-role-catalog.repository"
import { SystemRoleBindingRepository } from "@system/infrastructure/repositories/iam/system-role-binding.repository"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"

// @authorization permission iam:write - live権限・token失効・last-rootを同じ更新境界で検査する
export const DELETE = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  async (context) => {
    if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
      throw new SystemForbiddenError()
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const targetAccountId = zAccountId.safeParse(context.req.param("accountId"))
    const bindingId = roleBindingIdSchema.safeParse(context.req.param("bindingId"))
    if (!actorAccountId.success) {
      throw new SystemInvalidSessionError()
    }
    if (!targetAccountId.success || !bindingId.success) {
      throw new SystemRoleBindingNotFoundError()
    }
    const repository = new SystemRoleBindingRepository({
      env: { DB: context.env.DB },
    })
    const binding = await repository.find(bindingId.data)
    if (binding instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    if (
      binding === null ||
      binding.accountId !== targetAccountId.data ||
      binding.revokedAt !== null
    ) {
      throw new SystemRoleBindingNotFoundError()
    }
    const role = await new SystemRoleCatalogRepository({
      env: { DB: context.env.DB },
    }).find(binding.roleId)
    if (role instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    if (role === null) {
      throw new SystemRoleBindingNotFoundError()
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemIAMUnavailableError()
    }
    const beforeJson = StableSystemAuditJsonValue.create({
      account_id: binding.accountId,
      resource:
        binding.resource === null ? null : { id: binding.resource.id, type: binding.resource.type },
      role_id: binding.roleId,
    })
    if (beforeJson instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    const auditEvent = SystemAuditEventEntity.create({
      actorAccountId: actorAccountId.data,
      action: SYSTEM_AUDIT_ACTIONS.systemIamRoleBindingRevoked,
      targetType: "system:role-binding",
      targetId: binding.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: beforeJson?.toString() ?? null,
      afterJson: null,
      metadataJson: null,
      occurredAt: now,
    })
    if (auditEvent instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    const auditStatements = new SystemAuditEventRepository({
      env: { DB: context.env.DB },
    }).prepareAppend(auditEvent)
    const revocation = await repository.revoke(
      actorAccountId.data,
      role,
      binding,
      now,
      auditStatements,
    )
    if (revocation instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    if (revocation === "forbidden") {
      throw new SystemForbiddenError()
    }
    if (revocation === "not_found") {
      throw new SystemRoleBindingNotFoundError()
    }
    if (revocation === "last_root") {
      throw new SystemLastRootBindingError()
    }

    return context.body(null, 204)
  },
)
