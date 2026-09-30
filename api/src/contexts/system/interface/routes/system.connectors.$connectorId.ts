import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemConnectorRepository } from "@system/infrastructure/repositories/integration/system-connector.repository"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"
import {
  SystemForbiddenError,
  SystemIntegrationConflictError,
  SystemIntegrationInvalidError,
  SystemIntegrationNotFoundError,
  SystemIntegrationUnavailableError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { systemConnectorResponse } from "@system/interface/responses/system-connector-response"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission integration:write - step-upとexpected revisionでConnectorを停止・再開する
export const PATCH = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("param", z.object({ connectorId: z.string().regex(/^\S{1,255}$/) }).strict()),
  zValidator(
    "json",
    z
      .object({
        name: z.string().trim().min(1).max(200),
        status: z.enum(["active", "disabled"]),
        expected_revision: z.number().int().min(1),
        reason: z.string().trim().min(1).max(200),
      })
      .strict(),
  ),
  async (context) => {
    const now = context.var.now()
    const connectorId = context.req.valid("param").connectorId
    if (
      !authorizeSystemOperation(context.var.permissions, "integration:write", now, {
        scopedPermissionKeys: context.var.scopedPermissions,
        resource: { type: "system:connector", id: connectorId },
      })
    ) {
      throw new SystemForbiddenError()
    }
    const systemContext = { env: { DB: context.env.DB } }
    const repository = new SystemConnectorRepository(systemContext)
    const current = await repository.find(connectorId)
    if (current instanceof Error) throw new SystemIntegrationUnavailableError(current)
    if (current === null) throw new SystemIntegrationNotFoundError()
    const body = context.req.valid("json")
    if (current.revision !== body.expected_revision) throw new SystemIntegrationConflictError()
    const changed = current.revise({ name: body.name, status: body.status, at: now })
    if (changed instanceof Error) throw new SystemIntegrationInvalidError(changed)
    const before = StableSystemAuditJsonValue.create(systemConnectorResponse(current))
    const after = StableSystemAuditJsonValue.create(systemConnectorResponse(changed))
    if (before === null || after === null || before instanceof Error || after instanceof Error) {
      throw new SystemIntegrationUnavailableError(
        before === null || before instanceof Error ? before : after,
      )
    }
    const event = SystemAuditEventEntity.create({
      actorAccountId: context.var.userId,
      action: SYSTEM_AUDIT_ACTIONS.systemConnectorUpdated,
      targetType: "system:connector",
      targetId: current.id,
      outcome: "succeeded",
      reasonCode: body.reason,
      authorizationJson: null,
      beforeJson: before.toString(),
      afterJson: after.toString(),
      metadataJson: null,
      occurredAt: now,
    })
    if (event instanceof Error) throw new SystemIntegrationUnavailableError(event)
    const update = await repository.update(
      changed,
      body.expected_revision,
      new SystemAuditEventRepository(systemContext).prepareAppend(event),
    )
    if (update instanceof Error) throw new SystemIntegrationUnavailableError(update)
    if (update === "not_found") throw new SystemIntegrationNotFoundError()
    if (update === "conflict") throw new SystemIntegrationConflictError()
    return context.json({ connector: systemConnectorResponse(changed) }, 200)
  },
)
