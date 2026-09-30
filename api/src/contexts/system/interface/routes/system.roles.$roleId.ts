import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import {
  SystemForbiddenError,
  SystemIAMUnavailableError,
  SystemInvalidSessionError,
  SystemManagedRoleImmutableError,
  SystemRoleConflictError,
  SystemRoleInUseError,
  SystemRoleInvalidError,
  SystemRoleNotFoundError,
} from "@system/interface/errors"
/** /system/roles/:roleId */
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { iamRoleIdSchema } from "@system/domain/schemas/iam/iam-role.schema"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemRoleCatalogRepository } from "@system/infrastructure/repositories/iam/system-role-catalog.repository"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission iam:read - 一つのSystem Roleをpermission集合付きで読む
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:read")) {
    throw new SystemForbiddenError()
  }
  const roleId = iamRoleIdSchema.safeParse(context.req.param("roleId"))
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

  return context.json(
    {
      id: role.id,
      key: role.key,
      kind: role.kind,
      resource_type: role.resourceType,
      name: role.name,
      description: role.description,
      permission_keys: role.permissionKeys,
      created_at: role.createdAt.toISOString(),
      updated_at: role.updatedAt.toISOString(),
    },
    200,
  )
})

// @authorization permission iam:write - managed Role不変・permission昇格・last-rootを検査する
export const PATCH = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator(
    "json",
    z
      .object({
        name: z.string().min(1).max(100),
        description: z.string().min(1).max(1000).nullable(),
        permission_keys: z
          .array(
            z
              .string()
              .min(3)
              .max(100)
              .regex(/^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/),
          )
          .max(100),
      })
      .strict(),
  ),
  async (context) => {
    if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
      throw new SystemForbiddenError()
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const roleId = iamRoleIdSchema.safeParse(context.req.param("roleId"))
    if (!actorAccountId.success) {
      throw new SystemInvalidSessionError()
    }
    if (!roleId.success) {
      throw new SystemRoleNotFoundError()
    }
    const repository = new SystemRoleCatalogRepository({ env: { DB: context.env.DB } })
    const current = await repository.find(roleId.data)
    if (current instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    if (current === null) {
      throw new SystemRoleNotFoundError()
    }
    if (current.kind === "managed") {
      throw new SystemManagedRoleImmutableError()
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemIAMUnavailableError()
    }
    const body = context.req.valid("json")
    const revised = current.revise({
      name: body.name,
      description: body.description,
      permissionKeys: [...body.permission_keys].sort(),
      at: now,
    })
    if (revised instanceof Error) {
      throw new SystemRoleInvalidError()
    }
    if (revised === current) {
      return context.json(
        {
          id: current.id,
          key: current.key,
          kind: current.kind,
          resource_type: current.resourceType,
          name: current.name,
          description: current.description,
          permission_keys: current.permissionKeys,
          created_at: current.createdAt.toISOString(),
          updated_at: current.updatedAt.toISOString(),
        },
        200,
      )
    }
    const beforeJson = StableSystemAuditJsonValue.create({
      description: current.description,
      name: current.name,
      permission_keys: current.permissionKeys,
    })
    const afterJson = StableSystemAuditJsonValue.create({
      description: revised.description,
      name: revised.name,
      permission_keys: revised.permissionKeys,
    })
    if (beforeJson instanceof Error || afterJson instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    const auditEvent = SystemAuditEventEntity.create({
      actorAccountId: actorAccountId.data,
      action: SYSTEM_AUDIT_ACTIONS.systemIamRoleUpdated,
      targetType: "system:iam-role",
      targetId: current.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: beforeJson?.toString() ?? null,
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
    const update = await repository.update(actorAccountId.data, current, revised, auditStatements)
    if (update instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    if (update === "forbidden") {
      throw new SystemForbiddenError()
    }
    if (update === "managed_role") {
      throw new SystemManagedRoleImmutableError()
    }
    if (update === "conflict") {
      throw new SystemRoleConflictError()
    }

    return context.json(
      {
        id: revised.id,
        key: revised.key,
        kind: revised.kind,
        resource_type: revised.resourceType,
        name: revised.name,
        description: revised.description,
        permission_keys: revised.permissionKeys,
        created_at: revised.createdAt.toISOString(),
        updated_at: revised.updatedAt.toISOString(),
      },
      200,
    )
  },
)

// @authorization permission iam:write - active bindingを持つRoleとmanaged Roleは削除しない
export const DELETE = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  async (context) => {
    if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
      throw new SystemForbiddenError()
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const roleId = iamRoleIdSchema.safeParse(context.req.param("roleId"))
    if (!actorAccountId.success) {
      throw new SystemInvalidSessionError()
    }
    if (!roleId.success) {
      throw new SystemRoleNotFoundError()
    }
    const repository = new SystemRoleCatalogRepository({ env: { DB: context.env.DB } })
    const role = await repository.find(roleId.data)
    if (role instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    if (role === null) {
      throw new SystemRoleNotFoundError()
    }
    if (role.kind === "managed") {
      throw new SystemManagedRoleImmutableError()
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemIAMUnavailableError()
    }
    const beforeJson = StableSystemAuditJsonValue.create({
      description: role.description,
      key: role.key,
      kind: role.kind,
      resource_type: role.resourceType,
      name: role.name,
      permission_keys: role.permissionKeys,
    })
    if (beforeJson instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    const auditEvent = SystemAuditEventEntity.create({
      actorAccountId: actorAccountId.data,
      action: SYSTEM_AUDIT_ACTIONS.systemIamRoleDeleted,
      targetType: "system:iam-role",
      targetId: role.id,
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
    const deletion = await repository.delete(actorAccountId.data, role, auditStatements)
    if (deletion instanceof Error) {
      throw new SystemIAMUnavailableError()
    }
    if (deletion === "forbidden") {
      throw new SystemForbiddenError()
    }
    if (deletion === "managed_role") {
      throw new SystemManagedRoleImmutableError()
    }
    if (deletion === "role_in_use") {
      throw new SystemRoleInUseError()
    }

    return context.body(null, 204)
  },
)
