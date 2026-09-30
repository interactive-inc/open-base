import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemPrincipalRepository } from "@system/infrastructure/repositories/iam/system-principal.repository"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"
import {
  SystemForbiddenError,
  SystemPrincipalConflictError,
  SystemPrincipalInvalidError,
  SystemPrincipalNotFoundError,
  SystemPrincipalUnavailableError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { systemPrincipalResponse } from "@system/interface/responses/system-principal-response"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const params = z.object({ principalId: z.string().regex(/^\S{1,255}$/) }).strict()

// @authorization permission iam:read - 指定Principal分類を読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", params),
  async (context) => {
    if (!authorizeSystemOperation(context.var.permissions, "iam:read", context.var.now())) {
      throw new SystemForbiddenError()
    }
    const principal = await new SystemPrincipalRepository({
      env: { DB: context.env.DB },
    }).find({ principalId: context.req.valid("param").principalId })
    if (principal instanceof Error) throw new SystemPrincipalUnavailableError(principal)
    if (principal === null) throw new SystemPrincipalNotFoundError()

    return context.json({ principal: systemPrincipalResponse(principal) }, 200)
  },
)

// @authorization permission iam:write - step-upとexpected revisionを満たす名称変更だけを許す
export const PATCH = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("param", params),
  zValidator(
    "json",
    z
      .object({
        name: z.string().trim().min(1).max(200),
        expected_revision: z.number().int().min(1),
        reason: z.string().trim().min(1).max(200),
      })
      .strict(),
  ),
  async (context) => {
    const now = context.var.now()
    if (!authorizeSystemOperation(context.var.permissions, "iam:write", now)) {
      throw new SystemForbiddenError()
    }
    const body = context.req.valid("json")
    const repository = new SystemPrincipalRepository({ env: { DB: context.env.DB } })
    const current = await repository.find({ principalId: context.req.valid("param").principalId })
    if (current instanceof Error) throw new SystemPrincipalUnavailableError(current)
    if (current === null) throw new SystemPrincipalNotFoundError()
    if (current.revision !== body.expected_revision) throw new SystemPrincipalConflictError()
    const changed = current.withName(body.name, now)
    if (changed instanceof Error) throw new SystemPrincipalInvalidError(changed)
    const before = StableSystemAuditJsonValue.create(systemPrincipalResponse(current))
    const after = StableSystemAuditJsonValue.create(systemPrincipalResponse(changed))
    if (before === null || after === null || before instanceof Error || after instanceof Error) {
      throw new SystemPrincipalUnavailableError(
        before === null || before instanceof Error ? before : after,
      )
    }
    const event = SystemAuditEventEntity.create({
      actorAccountId: context.var.userId,
      action: SYSTEM_AUDIT_ACTIONS.systemPrincipalRenamed,
      targetType: "system:principal",
      targetId: changed.id,
      outcome: "succeeded",
      reasonCode: body.reason,
      authorizationJson: null,
      beforeJson: before.toString(),
      afterJson: after.toString(),
      metadataJson: null,
      occurredAt: now,
    })
    if (event instanceof Error) throw new SystemPrincipalUnavailableError(event)
    const systemContext = { env: { DB: context.env.DB } }
    const update = await new SystemPrincipalRepository(systemContext).update(
      changed,
      body.expected_revision,
      new SystemAuditEventRepository(systemContext).prepareAppend(event),
    )
    if (update instanceof Error) throw new SystemPrincipalUnavailableError(update)
    if (update === "not_found") throw new SystemPrincipalNotFoundError()
    if (update === "conflict") throw new SystemPrincipalConflictError()

    return context.json({ principal: systemPrincipalResponse(changed) }, 200)
  },
)
