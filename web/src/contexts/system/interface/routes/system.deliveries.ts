import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemDeliveryEntity } from "@system/domain/entities/system-delivery.entity"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemDeliveryRepository } from "@system/infrastructure/repositories/events/system-delivery.repository"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"
import {
  SystemDeliveryConflictError,
  SystemDeliveryInvalidError,
  SystemDeliveryUnavailableError,
  SystemForbiddenError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { systemDeliveryResponse } from "@system/interface/responses/system-delivery-response"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const deliveryBase = {
  id: z.uuid(),
  payload_digest: z.string().regex(/^[0-9a-f]{64}$/),
  idempotency_key: z.string().regex(/^\S{1,255}$/),
}

const createBody = z.discriminatedUnion("kind", [
  z
    .object({
      ...deliveryBase,
      kind: z.literal("job"),
      operation_key: z.string().regex(/^[a-z][a-z0-9_.:-]{0,199}$/),
      max_attempts: z.number().int().min(1).max(100),
      available_at: z.iso.datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      ...deliveryBase,
      kind: z.literal("outbox"),
      topic: z.string().regex(/^[a-z][a-z0-9_.:-]{0,199}$/),
      source_context: z.string().regex(/^[a-z][a-z0-9_-]{0,99}$/),
      source_kind: z.string().regex(/^[a-z][a-z0-9_-]{0,99}$/),
      source_id: z.string().regex(/^\S{1,255}$/),
      source_version: z.string().regex(/^\S{1,255}$/),
      max_attempts: z.number().int().min(1).max(100),
      available_at: z.iso.datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      ...deliveryBase,
      kind: z.literal("inbox"),
      source_key: z.string().regex(/^[a-z][a-z0-9_.:-]{0,199}$/),
      external_message_id: z.string().regex(/^\S{1,512}$/),
      received_at: z.iso.datetime({ offset: true }),
    })
    .strict(),
])

// @authorization permission batch:view - jobとoutboxのlifecycle metadataを読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "query",
    z
      .object({
        kind: z.enum(["job", "outbox"]),
        status: z.enum(["queued", "leased", "succeeded", "dead_letter"]).optional(),
      })
      .strict(),
  ),
  async (context) => {
    if (
      !authorizeSystemOperation(
        context.var.permissions,
        SystemFeaturePermission.BATCH_VIEW.key,
        context.var.now(),
      )
    ) {
      throw new SystemForbiddenError()
    }
    const query = context.req.valid("query")
    const deliveries = await new SystemDeliveryRepository({
      env: { DB: context.env.DB },
    }).findMany(query.kind, query.status ?? null)
    if (deliveries instanceof Error) throw new SystemDeliveryUnavailableError(deliveries)
    return context.json({ deliveries: deliveries.map(systemDeliveryResponse) }, 200)
  },
)

// @authorization permission batch:write - digest参照だけを持つjob・outbox・inboxを冪等登録する
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("json", createBody),
  async (context) => {
    const body = context.req.valid("json")
    const now = context.var.now()
    const permission = body.kind === "job" ? "batch:write" : "integration:write"
    if (!authorizeSystemOperation(context.var.permissions, permission, now)) {
      throw new SystemForbiddenError()
    }
    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) throw new SystemDeliveryUnavailableError(accountId.error)
    const systemContext = { env: { DB: context.env.DB } }
    const repository = new SystemDeliveryRepository(systemContext)

    if (body.kind === "inbox") {
      const metadata = StableSystemAuditJsonValue.create({
        source_key: body.source_key,
        external_message_id: body.external_message_id,
        payload_digest: body.payload_digest,
      })
      if (metadata === null || metadata instanceof Error) {
        throw new SystemDeliveryUnavailableError(metadata)
      }
      const event = SystemAuditEventEntity.create({
        actorAccountId: accountId.data,
        action: SYSTEM_AUDIT_ACTIONS.systemInboxAccepted,
        targetType: "system:inbox_message",
        targetId: body.id,
        outcome: "succeeded",
        reasonCode: null,
        authorizationJson: null,
        beforeJson: null,
        afterJson: metadata.toString(),
        metadataJson: null,
        occurredAt: now,
      })
      if (event instanceof Error) throw new SystemDeliveryUnavailableError(event)
      const result = await repository.acceptInbox(
        {
          id: body.id,
          sourceKey: body.source_key,
          externalMessageId: body.external_message_id,
          payloadDigest: body.payload_digest,
          receivedAt: new Date(body.received_at),
        },
        new SystemAuditEventRepository(systemContext).prepareAppend(event),
      )
      if (result instanceof Error) throw new SystemDeliveryUnavailableError(result)
      if (result === "conflict") throw new SystemDeliveryConflictError()
      return context.json(
        { id: body.id, kind: body.kind, replayed: result === "replayed" },
        result === "replayed" ? 200 : 201,
      )
    }

    const delivery = SystemDeliveryEntity.create({
      id: body.id,
      kind: body.kind,
      operationKey: body.kind === "job" ? body.operation_key : body.topic,
      payloadDigest: body.payload_digest,
      idempotencyKey: body.idempotency_key,
      status: "queued",
      attempt: 0,
      maxAttempts: body.max_attempts,
      availableAt: new Date(body.available_at),
      leaseAccountId: null,
      leaseTokenHash: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    })
    if (delivery instanceof Error) throw new SystemDeliveryInvalidError(delivery)
    const after = StableSystemAuditJsonValue.create(systemDeliveryResponse(delivery))
    if (after === null || after instanceof Error) throw new SystemDeliveryUnavailableError(after)
    const event = SystemAuditEventEntity.create({
      actorAccountId: accountId.data,
      action:
        body.kind === "job"
          ? SYSTEM_AUDIT_ACTIONS.systemJobQueued
          : SYSTEM_AUDIT_ACTIONS.systemOutboxQueued,
      targetType: body.kind === "job" ? "system:job" : "system:outbox_message",
      targetId: body.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: after.toString(),
      metadataJson: null,
      occurredAt: now,
    })
    if (event instanceof Error) throw new SystemDeliveryUnavailableError(event)
    const result = await repository.create(
      delivery,
      accountId.data,
      body.kind === "outbox"
        ? {
            topic: body.topic,
            sourceContext: body.source_context,
            sourceKind: body.source_kind,
            sourceId: body.source_id,
            sourceVersion: body.source_version,
          }
        : null,
      new SystemAuditEventRepository(systemContext).prepareAppend(event),
    )
    if (result instanceof Error) throw new SystemDeliveryUnavailableError(result)
    if (result === "conflict") throw new SystemDeliveryConflictError()
    return context.json(
      { delivery: systemDeliveryResponse(delivery), replayed: result === "replayed" },
      result === "replayed" ? 200 : 201,
    )
  },
)
