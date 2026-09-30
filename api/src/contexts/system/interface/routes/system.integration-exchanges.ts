import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
/** /system/integration-exchanges */
import { CreateIntegrationExchange } from "@system/application/integration/create-integration-exchange"
import { IntegrationExchangeEntity } from "@system/domain/entities/integration-exchange.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemIntegrationExchangeRepository } from "@system/infrastructure/repositories/integration/system-integration-exchange.repository"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"
import {
  SystemForbiddenError,
  SystemIntegrationConflictError,
  SystemIntegrationInvalidError,
  SystemIntegrationUnavailableError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { systemIntegrationExchangeResponse } from "@system/interface/responses/system-integration-exchange-response"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission integration:read - Connector単位の外部交換履歴を読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("query", z.object({ connector_id: z.string().regex(/^\S{1,255}$/) })),
  async (context) => {
    const connectorId = context.req.valid("query").connector_id
    if (
      !authorizeSystemOperation(context.var.permissions, "integration:read", context.var.now(), {
        scopedPermissionKeys: context.var.scopedPermissions,
        resource: { type: "system:connector", id: connectorId },
      })
    ) {
      throw new SystemForbiddenError()
    }
    const exchanges = await new SystemIntegrationExchangeRepository({
      env: { DB: context.env.DB },
    }).findMany(connectorId)
    if (exchanges instanceof Error) throw new SystemIntegrationUnavailableError(exchanges)
    return context.json({ exchanges }, 200)
  },
)

// @authorization permission integration:write - digestとidempotency keyで交換を開始する
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "json",
    z.object({
      id: z.string().regex(/^\S{1,255}$/),
      connector_id: z.string().regex(/^\S{1,255}$/),
      direction: z.enum(["inbound", "outbound"]),
      operation_key: z.string().regex(/^[a-z][a-z0-9_.:-]{0,199}$/),
      idempotency_key: z.string().regex(/^\S{1,255}$/),
      payload_digest: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  ),
  async (context) => {
    const now = context.var.now()
    const body = context.req.valid("json")
    if (
      !authorizeSystemOperation(context.var.permissions, "integration:write", now, {
        scopedPermissionKeys: context.var.scopedPermissions,
        resource: { type: "system:connector", id: body.connector_id },
      })
    ) {
      throw new SystemForbiddenError()
    }
    const input = {
      id: body.id,
      connectorId: body.connector_id,
      direction: body.direction,
      operationKey: body.operation_key,
      idempotencyKey: body.idempotency_key,
      payloadDigest: body.payload_digest,
      status: "pending",
      attempt: 1,
      externalReference: null,
      lastErrorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    }
    const exchange = IntegrationExchangeEntity.create(input)
    if (exchange instanceof Error) throw new SystemIntegrationInvalidError(exchange)
    const after = StableSystemAuditJsonValue.create(systemIntegrationExchangeResponse(exchange))
    if (after === null || after instanceof Error) {
      throw new SystemIntegrationUnavailableError(after)
    }
    const event = SystemAuditEventEntity.create({
      actorAccountId: context.var.userId,
      action: SYSTEM_AUDIT_ACTIONS.systemIntegrationExchangeCreated,
      targetType: "system:integration_exchange",
      targetId: exchange.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: after.toString(),
      metadataJson: null,
      occurredAt: now,
    })
    if (event instanceof Error) throw new SystemIntegrationUnavailableError(event)
    const systemContext = { env: { DB: context.env.DB } }
    const repository = new SystemIntegrationExchangeRepository(systemContext)
    const auditStatements = new SystemAuditEventRepository(systemContext).prepareAppend(event)
    const result = await new CreateIntegrationExchange({
      write: (value, expectedUpdatedAt) =>
        repository.write(value, expectedUpdatedAt, auditStatements),
    }).execute(input)
    if (result instanceof Error) throw new SystemIntegrationInvalidError(result)
    if (result.kind === "conflict") throw new SystemIntegrationConflictError()
    if (result.kind === "unavailable") throw new SystemIntegrationUnavailableError(result.cause)
    return context.json(
      { exchange: result.exchange, replayed: result.replayed },
      result.replayed ? 200 : 201,
    )
  },
)
