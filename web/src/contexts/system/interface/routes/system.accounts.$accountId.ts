import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import {
  SystemAccountNotFoundError,
  SystemAccountUnavailableError,
  SystemForbiddenError,
  SystemInvalidSessionError,
  SystemLastRootAccountError,
} from "@system/interface/errors"
/** /system/accounts/:accountId */
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemAccountCatalogRepository } from "@system/infrastructure/repositories/iam/system-account-catalog.repository"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission iam:read - 一つのSystem AccountをCompany情報なしで読む
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
    throw new SystemAccountUnavailableError()
  }
  if (account === null) {
    throw new SystemAccountNotFoundError()
  }

  return context.json(
    {
      id: account.id,
      status: account.status,
      token_version: account.tokenVersion,
      role_keys: account.roleKeys,
      created_at: account.createdAt.toISOString(),
      updated_at: account.updatedAt.toISOString(),
    },
    200,
  )
})

// @authorization permission iam:write - live権限・自己停止・last-rootを同じ更新境界で検査する
export const PATCH = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("json", z.object({ status: z.enum(["active", "suspended", "locked"]) }).strict()),
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

    const repository = new SystemAccountCatalogRepository({ env: { DB: context.env.DB } })
    const before = await repository.find(targetAccountId.data)
    if (before instanceof Error) {
      throw new SystemAccountUnavailableError()
    }
    if (before === null) {
      throw new SystemAccountNotFoundError()
    }
    const body = context.req.valid("json")
    if (before.status === body.status) {
      return context.json(
        {
          id: before.id,
          status: before.status,
          token_version: before.tokenVersion,
          role_keys: before.roleKeys,
          created_at: before.createdAt.toISOString(),
          updated_at: before.updatedAt.toISOString(),
        },
        200,
      )
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemAccountUnavailableError()
    }
    const beforeJson = StableSystemAuditJsonValue.create({
      status: before.status,
      token_version: before.tokenVersion,
    })
    const afterJson = StableSystemAuditJsonValue.create({
      status: body.status,
      token_version: before.tokenVersion + 1,
    })
    if (beforeJson instanceof Error || afterJson instanceof Error) {
      throw new SystemAccountUnavailableError()
    }
    const auditEvent = SystemAuditEventEntity.create({
      actorAccountId: actorAccountId.data,
      action: SYSTEM_AUDIT_ACTIONS.systemAccountStatusUpdated,
      targetType: "system:account",
      targetId: targetAccountId.data,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: beforeJson?.toString() ?? null,
      afterJson: afterJson?.toString() ?? null,
      metadataJson: null,
      occurredAt: now,
    })
    if (auditEvent instanceof Error) {
      throw new SystemAccountUnavailableError()
    }
    const auditStatements = new SystemAuditEventRepository({
      env: { DB: context.env.DB },
    }).prepareAppend(auditEvent)
    const update = await repository.setStatus(
      actorAccountId.data,
      targetAccountId.data,
      body.status,
      now,
      auditStatements,
    )
    if (update instanceof Error) {
      throw new SystemAccountUnavailableError()
    }
    if (update === "not_found") {
      throw new SystemAccountNotFoundError()
    }
    if (update === "forbidden") {
      throw new SystemForbiddenError()
    }
    if (update === "last_root") {
      throw new SystemLastRootAccountError()
    }

    const account = await repository.find(targetAccountId.data)
    if (account === null || account instanceof Error) {
      throw new SystemAccountUnavailableError()
    }

    return context.json(
      {
        id: account.id,
        status: account.status,
        token_version: account.tokenVersion,
        role_keys: account.roleKeys,
        created_at: account.createdAt.toISOString(),
        updated_at: account.updatedAt.toISOString(),
      },
      200,
    )
  },
)
