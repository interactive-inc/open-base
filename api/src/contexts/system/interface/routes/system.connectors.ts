import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
/** /system/connectors */
import { CreateSystemConnector } from "@system/application/integration/create-system-connector"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemConnectorRepository } from "@system/infrastructure/repositories/integration/system-connector.repository"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"
import {
  SystemForbiddenError,
  SystemIntegrationConflictError,
  SystemIntegrationInvalidError,
  SystemIntegrationUnavailableError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission integration:read - Connector定義だけを読む
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!authorizeSystemOperation(context.var.permissions, "integration:read", context.var.now())) {
    throw new SystemForbiddenError()
  }
  const connectors = await new SystemConnectorRepository({ env: { DB: context.env.DB } }).findMany()
  if (connectors instanceof Error) throw new SystemIntegrationUnavailableError(connectors)
  return context.json({ connectors }, 200)
})

// @authorization permission integration:write - secretを含まないConnector定義を作成する
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator(
    "json",
    z
      .object({
        id: z.string().regex(/^\S{1,255}$/),
        key: z.string().regex(/^[a-z][a-z0-9_-]{0,62}$/),
        name: z.string().trim().min(1).max(200),
        direction: z.enum(["inbound", "outbound", "bidirectional"]),
        transport: z.enum(["api", "file", "webhook"]),
      })
      .strict(),
  ),
  async (context) => {
    const now = context.var.now()
    if (!authorizeSystemOperation(context.var.permissions, "integration:write", now)) {
      throw new SystemForbiddenError()
    }
    const body = context.req.valid("json")
    const after = StableSystemAuditJsonValue.create({
      id: body.id,
      key: body.key,
      name: body.name,
      direction: body.direction,
      transport: body.transport,
      status: "active",
      revision: 1,
    })
    if (after === null || after instanceof Error) {
      throw new SystemIntegrationUnavailableError(after)
    }
    const event = SystemAuditEventEntity.create({
      actorAccountId: context.var.userId,
      action: SYSTEM_AUDIT_ACTIONS.systemConnectorCreated,
      targetType: "system:connector",
      targetId: body.id,
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
    const repository = new SystemConnectorRepository(systemContext)
    const auditStatements = new SystemAuditEventRepository(systemContext).prepareAppend(event)
    const result = await new CreateSystemConnector({
      write: (connector) => repository.write(connector, auditStatements),
    }).execute({
      id: body.id,
      key: body.key,
      name: body.name,
      direction: body.direction,
      transport: body.transport,
      status: "active",
      revision: 1,
      createdAt: now,
      updatedAt: now,
    })
    if (result instanceof Error) throw new SystemIntegrationInvalidError(result)
    if (result.kind === "conflict") throw new SystemIntegrationConflictError()
    if (result.kind === "unavailable") throw new SystemIntegrationUnavailableError(result.cause)
    return context.json(
      { connector: result.connector, replayed: result.kind === "replayed" },
      result.kind === "replayed" ? 200 : 201,
    )
  },
)
