import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
/** /system/integration-exchanges/:exchangeId */
import { UpdateIntegrationExchange } from "@system/application/integration/update-integration-exchange"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemIntegrationExchangeRepository } from "@system/infrastructure/repositories/integration/system-integration-exchange.repository"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"
import {
  SystemForbiddenError,
  SystemIntegrationConflictError,
  SystemIntegrationInvalidError,
  SystemIntegrationNotFoundError,
  SystemIntegrationUnavailableError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { systemIntegrationExchangeResponse } from "@system/interface/responses/system-integration-exchange-response"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const systemIntegrationExchangeAuditActions = Object.freeze({
  pending: SYSTEM_AUDIT_ACTIONS.systemIntegrationExchangePending,
  succeeded: SYSTEM_AUDIT_ACTIONS.systemIntegrationExchangeSucceeded,
  failed: SYSTEM_AUDIT_ACTIONS.systemIntegrationExchangeFailed,
  cancelled: SYSTEM_AUDIT_ACTIONS.systemIntegrationExchangeCancelled,
})

// @authorization permission integration:read - 一つの外部交換を読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.object({ exchangeId: z.string().regex(/^\S{1,255}$/) })),
  async (context) => {
    const exchange = await new SystemIntegrationExchangeRepository({
      env: { DB: context.env.DB },
    }).find(context.req.valid("param").exchangeId)
    if (exchange instanceof Error) throw new SystemIntegrationUnavailableError(exchange)
    if (exchange === null) throw new SystemIntegrationNotFoundError()
    if (
      !authorizeSystemOperation(context.var.permissions, "integration:read", context.var.now(), {
        scopedPermissionKeys: context.var.scopedPermissions,
        resource: { type: "system:connector", id: exchange.connectorId },
      })
    ) {
      throw new SystemForbiddenError()
    }
    return context.json({ exchange }, 200)
  },
)

// @authorization permission integration:write - 交換を成功・失敗・取消・retryへ進める
export const PATCH = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.object({ exchangeId: z.string().regex(/^\S{1,255}$/) })),
  zValidator(
    "json",
    z.object({
      status: z.enum(["pending", "succeeded", "failed", "cancelled"]),
      external_reference: z.string().trim().min(1).max(512).nullable().default(null),
      error_code: z
        .string()
        .regex(/^[a-z][a-z0-9_.:-]{0,199}$/)
        .nullable()
        .default(null),
    }),
  ),
  async (context) => {
    const now = context.var.now()
    const body = context.req.valid("json")
    const systemContext = { env: { DB: context.env.DB } }
    const repository = new SystemIntegrationExchangeRepository(systemContext)
    const exchangeId = context.req.valid("param").exchangeId
    const current = await repository.find(exchangeId)
    if (current instanceof Error) throw new SystemIntegrationUnavailableError(current)
    if (current === null) throw new SystemIntegrationNotFoundError()
    if (
      !authorizeSystemOperation(context.var.permissions, "integration:write", now, {
        scopedPermissionKeys: context.var.scopedPermissions,
        resource: { type: "system:connector", id: current.connectorId },
      })
    ) {
      throw new SystemForbiddenError()
    }
    const updated = current.transition(body.status, now, {
      externalReference: body.external_reference,
      errorCode: body.error_code,
    })
    if (updated instanceof Error) throw new SystemIntegrationInvalidError(updated)
    const before = StableSystemAuditJsonValue.create(systemIntegrationExchangeResponse(current))
    const after = StableSystemAuditJsonValue.create(systemIntegrationExchangeResponse(updated))
    if (before === null || after === null || before instanceof Error || after instanceof Error) {
      throw new SystemIntegrationUnavailableError(
        before === null || before instanceof Error ? before : after,
      )
    }
    const event = SystemAuditEventEntity.create({
      actorAccountId: context.var.userId,
      action: systemIntegrationExchangeAuditActions[body.status],
      targetType: "system:integration_exchange",
      targetId: current.id,
      outcome: "succeeded",
      reasonCode: body.error_code,
      authorizationJson: null,
      beforeJson: before.toString(),
      afterJson: after.toString(),
      metadataJson: null,
      occurredAt: now,
    })
    if (event instanceof Error) throw new SystemIntegrationUnavailableError(event)
    const auditStatements = new SystemAuditEventRepository(systemContext).prepareAppend(event)
    const result = await new UpdateIntegrationExchange({
      find: (id) => repository.find(id),
      write: (value, expectedUpdatedAt) =>
        repository.write(value, expectedUpdatedAt, auditStatements),
    }).execute({
      id: exchangeId,
      status: body.status,
      at: now,
      externalReference: body.external_reference,
      errorCode: body.error_code,
    })
    if (result === null) throw new SystemIntegrationNotFoundError()
    if (result instanceof Error) throw new SystemIntegrationInvalidError(result)
    if (result.kind === "conflict") throw new SystemIntegrationConflictError()
    if (result.kind === "unavailable") throw new SystemIntegrationUnavailableError(result.cause)
    return context.json({ exchange: result.exchange }, 200)
  },
)
