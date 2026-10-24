import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
/** /system/integration-exchanges/:exchangeId/reconciliations */
import { ReconcileIntegrationExchange } from "@system/application/integration/reconcile-integration-exchange"
import { ReconciliationRunEntity } from "@system/domain/entities/reconciliation-run.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemIntegrationExchangeRepository } from "@system/infrastructure/repositories/integration/system-integration-exchange.repository"
import { SystemReconciliationRepository } from "@system/infrastructure/repositories/integration/system-reconciliation.repository"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"
import {
  SystemForbiddenError,
  SystemIntegrationConflictError,
  SystemIntegrationInvalidError,
  SystemIntegrationUnavailableError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const exchangeParam = z.object({ exchangeId: z.string().regex(/^\S{1,255}$/) })

// @authorization permission integration:read - 外部交換の照合履歴を読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", exchangeParam),
  async (context) => {
    const exchangeId = context.req.valid("param").exchangeId
    const exchange = await new SystemIntegrationExchangeRepository({
      env: { DB: context.env.DB },
    }).find(exchangeId)
    if (exchange instanceof Error) throw new SystemIntegrationUnavailableError(exchange)
    if (
      exchange === null ||
      !authorizeSystemOperation(context.var.permissions, "integration:read", context.var.now(), {
        scopedPermissionKeys: context.var.scopedPermissions,
        resource: { type: "system:connector", id: exchange.connectorId },
      })
    ) {
      throw new SystemForbiddenError()
    }
    const runs = await new SystemReconciliationRepository({
      env: { DB: context.env.DB },
    }).findMany(exchangeId)
    if (runs instanceof Error) throw new SystemIntegrationUnavailableError(runs)
    return context.json({ reconciliations: runs }, 200)
  },
)

// @authorization permission integration:write - immutable assertionとsemantic item差分を記録する
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", exchangeParam),
  zValidator(
    "json",
    z.object({
      id: z.string().regex(/^\S{1,255}$/),
      connector_id: z.string().regex(/^\S{1,255}$/),
      assertion: z.object({
        id: z.string().regex(/^\S{1,255}$/),
        external_key: z.string().trim().min(1).max(512),
        external_version: z.string().trim().min(1).max(255),
        payload_digest: z.string().regex(/^[0-9a-f]{64}$/),
        observed_at: z.string().datetime(),
      }),
      local_version: z.string().trim().min(1).max(255),
      items: z
        .array(
          z.object({
            key: z.string().trim().min(1).max(512),
            local_digest: z
              .string()
              .regex(/^[0-9a-f]{64}$/)
              .nullable(),
            external_digest: z
              .string()
              .regex(/^[0-9a-f]{64}$/)
              .nullable(),
          }),
        )
        .min(1)
        .max(10_000),
    }),
  ),
  async (context) => {
    const now = context.var.now()
    const body = context.req.valid("json")
    const exchangeId = context.req.valid("param").exchangeId
    const exchange = await new SystemIntegrationExchangeRepository({
      env: { DB: context.env.DB },
    }).find(exchangeId)
    if (exchange instanceof Error) throw new SystemIntegrationUnavailableError(exchange)
    if (
      exchange === null ||
      exchange.connectorId !== body.connector_id ||
      !authorizeSystemOperation(context.var.permissions, "integration:write", now, {
        scopedPermissionKeys: context.var.scopedPermissions,
        resource: { type: "system:connector", id: exchange.connectorId },
      })
    ) {
      throw new SystemForbiddenError()
    }
    const assertionInput = {
      id: body.assertion.id,
      connectorId: body.connector_id,
      exchangeId,
      externalKey: body.assertion.external_key,
      externalVersion: body.assertion.external_version,
      payloadDigest: body.assertion.payload_digest,
      observedAt: new Date(body.assertion.observed_at),
      receivedAt: now,
    }
    const reconciliationInput = {
      id: body.id,
      exchangeId,
      assertionId: body.assertion.id,
      localVersion: body.local_version,
      createdAt: now,
      items: body.items.map((item) => ({
        key: item.key,
        localDigest: item.local_digest,
        externalDigest: item.external_digest,
      })),
    }
    const reconciliation = ReconciliationRunEntity.create(reconciliationInput)
    if (reconciliation instanceof Error) {
      throw new SystemIntegrationInvalidError(reconciliation)
    }
    const after = StableSystemAuditJsonValue.create({
      id: reconciliation.id,
      exchange_id: reconciliation.exchangeId,
      assertion_id: reconciliation.assertionId,
      local_version: reconciliation.localVersion,
      status: reconciliation.status,
      item_count: reconciliation.items.length,
      created_at: reconciliation.createdAt.toISOString(),
    })
    if (after === null || after instanceof Error) {
      throw new SystemIntegrationUnavailableError(after)
    }
    const event = SystemAuditEventEntity.create({
      actorAccountId: context.var.userId,
      action: SYSTEM_AUDIT_ACTIONS.systemIntegrationReconciliationRecorded,
      targetType: "system:integration_reconciliation",
      targetId: reconciliation.id,
      outcome: "succeeded",
      reasonCode: reconciliation.status === "mismatched" ? "semantic_difference" : null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: after.toString(),
      metadataJson: null,
      occurredAt: now,
    })
    if (event instanceof Error) throw new SystemIntegrationUnavailableError(event)
    const systemContext = { env: { DB: context.env.DB } }
    const repository = new SystemReconciliationRepository(systemContext)
    const auditStatements = new SystemAuditEventRepository(systemContext).prepareAppend(event)
    const result = await new ReconcileIntegrationExchange({
      write: (assertion, run) => repository.write(assertion, run, auditStatements),
    }).execute({ assertion: assertionInput, reconciliation: reconciliationInput })
    if (result instanceof Error) throw new SystemIntegrationInvalidError(result)
    if (result.kind === "conflict") throw new SystemIntegrationConflictError()
    if (result.kind === "unavailable") throw new SystemIntegrationUnavailableError(result.cause)
    return context.json({ reconciliation: result.run }, 201)
  },
)
