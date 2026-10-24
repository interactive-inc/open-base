import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import {
  SystemAccountNotFoundError,
  SystemForbiddenError,
  SystemIAMUnavailableError,
  SystemInvalidSessionError,
  SystemRoleBindingConflictError,
  SystemRoleBindingInvalidError,
  SystemRoleNotFoundError,
  SystemSelfAssignmentForbiddenError,
} from "@system/interface/errors"
/** /system/accounts/:accountId/role-bindings */
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { iamRoleIdSchema } from "@system/domain/schemas/iam/iam-role.schema"
import { RoleBindingEntity } from "@system/domain/entities/role-binding.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemAccountCatalogRepository } from "@system/infrastructure/repositories/iam/system-account-catalog.repository"
import { SystemRoleCatalogRepository } from "@system/infrastructure/repositories/iam/system-role-catalog.repository"
import { SystemRoleBindingRepository } from "@system/infrastructure/repositories/iam/system-role-binding.repository"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission iam:read - Accountが所有するSystem Role Binding履歴を読む
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:read")) {
    throw new SystemForbiddenError()
  }
  const accountId = zAccountId.safeParse(context.req.param("accountId"))
  if (!accountId.success) {
    throw new SystemAccountNotFoundError()
  }
  const account = await new SystemAccountCatalogRepository({
    env: { DB: context.env.DB },
  }).find(accountId.data)
  if (account instanceof Error) {
    throw new SystemIAMUnavailableError()
  }
  if (account === null) {
    throw new SystemAccountNotFoundError()
  }
  const bindings = await new SystemRoleBindingRepository({
    env: { DB: context.env.DB },
  }).findMany(accountId.data)
  if (bindings instanceof Error) {
    throw new SystemIAMUnavailableError()
  }

  return context.json(
    {
      role_bindings: bindings.map((binding) => ({
        id: binding.id,
        account_id: binding.accountId,
        role_id: binding.roleId,
        resource:
          binding.resource === null
            ? null
            : { type: binding.resource.type, id: binding.resource.id },
        created_at: binding.createdAt.toISOString(),
        revoked_at: binding.revokedAt?.toISOString() ?? null,
      })),
      total: bindings.length,
    },
    200,
  )
})

// @authorization permission iam:write - 自己付与とactor未保有permissionの付与を拒否する
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator(
    "json",
    z
      .object({
        role_id: z.string().min(1).max(255),
        resource: z
          .object({
            type: z
              .string()
              .min(3)
              .max(100)
              .regex(/^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/),
            id: z.string().min(1).max(255),
          })
          .strict()
          .nullable(),
      })
      .strict(),
  ),
  async (context) => {
    if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
      throw new SystemForbiddenError()
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const targetAccountId = zAccountId.safeParse(context.req.param("accountId"))
    if (!actorAccountId.success) {
      throw new SystemInvalidSessionError()
    }
    if (!targetAccountId.success) {
      throw new SystemAccountNotFoundError()
    }
    if (actorAccountId.data === targetAccountId.data) {
      throw new SystemSelfAssignmentForbiddenError()
    }
    const body = context.req.valid("json")
    const roleId = iamRoleIdSchema.safeParse(body.role_id)
    if (!roleId.success) {
      throw new SystemRoleNotFoundError()
    }
    const role = await new SystemRoleCatalogRepository({
      env: { DB: context.env.DB },
    }).find(roleId.data)
    if (role instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    if (role === null) {
      throw new SystemRoleNotFoundError()
    }
    if (!role.acceptsBindingResource(body.resource?.type ?? null)) {
      throw new SystemRoleBindingInvalidError()
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemIAMUnavailableError()
    }
    const binding = RoleBindingEntity.create({
      id: crypto.randomUUID(),
      accountId: targetAccountId.data,
      roleId: role.id,
      resource: body.resource,
      createdAt: now,
      revokedAt: null,
    })
    if (binding instanceof Error) {
      throw new SystemRoleBindingInvalidError()
    }
    const afterJson = StableSystemAuditJsonValue.create({
      account_id: binding.accountId,
      resource:
        binding.resource === null ? null : { id: binding.resource.id, type: binding.resource.type },
      role_id: binding.roleId,
    })
    if (afterJson instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    const auditEvent = SystemAuditEventEntity.create({
      actorAccountId: actorAccountId.data,
      action: SYSTEM_AUDIT_ACTIONS.systemIamRoleBindingCreated,
      targetType: "system:role-binding",
      targetId: binding.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: afterJson?.toString() ?? null,
      metadataJson: null,
      occurredAt: now,
    })
    if (auditEvent instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    const auditStatements = new SystemAuditEventRepository({
      env: { DB: context.env.DB },
    }).prepareAppend(auditEvent)
    const creation = await new SystemRoleBindingRepository({
      env: { DB: context.env.DB },
    }).create(actorAccountId.data, role, binding, auditStatements)
    if (creation instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    if (creation === "forbidden") {
      throw new SystemForbiddenError()
    }
    if (creation === "conflict") {
      throw new SystemRoleBindingConflictError()
    }

    return context.json(
      {
        id: binding.id,
        account_id: binding.accountId,
        role_id: binding.roleId,
        resource:
          binding.resource === null
            ? null
            : { type: binding.resource.type, id: binding.resource.id },
        created_at: binding.createdAt.toISOString(),
        revoked_at: null,
      },
      201,
    )
  },
)
