import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemDeliveryRepository } from "@system/infrastructure/repositories/events/system-delivery.repository"
import { SystemPrincipalRepository } from "@system/infrastructure/repositories/iam/system-principal.repository"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"
import {
  SystemDeliveryConflictError,
  SystemDeliveryNotFoundError,
  SystemDeliveryUnavailableError,
  SystemForbiddenError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { transitionSystemDelivery } from "@system/interface/operations/transition-system-delivery"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { systemDeliveryResponse } from "@system/interface/responses/system-delivery-response"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const body = z.discriminatedUnion("action", [
  z
    .object({
      kind: z.enum(["job", "outbox"]),
      action: z.literal("claim"),
      lease_seconds: z.number().int().min(1).max(3_600),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["job", "outbox"]),
      action: z.literal("heartbeat"),
      lease_token: z.string().regex(/^[0-9a-f]{64}$/),
      lease_seconds: z.number().int().min(1).max(3_600),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["job", "outbox"]),
      action: z.literal("succeed"),
      lease_token: z.string().regex(/^[0-9a-f]{64}$/),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["job", "outbox"]),
      action: z.literal("fail"),
      lease_token: z.string().regex(/^[0-9a-f]{64}$/),
      error_code: z.string().regex(/^[a-z][a-z0-9_.:-]{0,199}$/),
      retry_at: z.iso.datetime({ offset: true }),
    })
    .strict(),
  z.object({ kind: z.enum(["job", "outbox"]), action: z.literal("recover") }).strict(),
])

const systemDeliveryAuditActions = Object.freeze({
  job: Object.freeze({
    claim: SYSTEM_AUDIT_ACTIONS.systemJobClaim,
    heartbeat: SYSTEM_AUDIT_ACTIONS.systemJobHeartbeat,
    succeed: SYSTEM_AUDIT_ACTIONS.systemJobSucceed,
    fail: SYSTEM_AUDIT_ACTIONS.systemJobFail,
    recover: SYSTEM_AUDIT_ACTIONS.systemJobRecover,
  }),
  outbox: Object.freeze({
    claim: SYSTEM_AUDIT_ACTIONS.systemOutboxClaim,
    heartbeat: SYSTEM_AUDIT_ACTIONS.systemOutboxHeartbeat,
    succeed: SYSTEM_AUDIT_ACTIONS.systemOutboxSucceed,
    fail: SYSTEM_AUDIT_ACTIONS.systemOutboxFail,
    recover: SYSTEM_AUDIT_ACTIONS.systemOutboxRecover,
  }),
})

// @authorization permission batch:execute - 機械Principalのlease tokenでjob・outboxを単調遷移する
export const PATCH = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.object({ deliveryId: z.string().regex(/^\S{1,255}$/) }).strict()),
  zValidator("json", body),
  async (context) => {
    const input = context.req.valid("json")
    const now = context.var.now()
    const permission = input.kind === "job" ? "batch:execute" : "integration:write"
    if (!authorizeSystemOperation(context.var.permissions, permission, now)) {
      throw new SystemForbiddenError()
    }
    if (input.action === "recover" && !context.var.permissions.has("system:admin")) {
      throw new SystemForbiddenError()
    }
    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) throw new SystemDeliveryUnavailableError(accountId.error)
    if (input.action === "claim") {
      const principal = await new SystemPrincipalRepository({
        env: { DB: context.env.DB },
      }).find({ accountId: accountId.data })
      if (principal instanceof Error) throw new SystemDeliveryUnavailableError(principal)
      if (principal === null || principal.kind === "human") throw new SystemForbiddenError()
    }
    const systemContext = { env: { DB: context.env.DB } }
    const repository = new SystemDeliveryRepository(systemContext)
    const current = await repository.find(input.kind, context.req.valid("param").deliveryId)
    if (current instanceof Error) throw new SystemDeliveryUnavailableError(current)
    if (current === null) throw new SystemDeliveryNotFoundError()
    if (current.handlerKey !== null) throw new SystemForbiddenError()
    const material = new SystemPrincipalSecretService()
    const rawLeaseToken = input.action === "claim" ? material.generateRawSecret() : null
    if (rawLeaseToken instanceof Error) throw new SystemDeliveryUnavailableError(rawLeaseToken)
    const rawToken =
      input.action === "claim"
        ? rawLeaseToken
        : input.action === "recover"
          ? null
          : input.lease_token
    const leaseTokenHash = rawToken === null ? null : await material.hashRawSecret(rawToken)
    if (leaseTokenHash instanceof Error) throw new SystemDeliveryUnavailableError(leaseTokenHash)

    const next = transitionSystemDelivery({
      current,
      input,
      accountId: accountId.data,
      leaseTokenHash,
      now,
    })
    if (next instanceof Error) throw new SystemDeliveryConflictError()
    const before = StableSystemAuditJsonValue.create(systemDeliveryResponse(current))
    const after = StableSystemAuditJsonValue.create(systemDeliveryResponse(next))
    if (before === null || after === null || before instanceof Error || after instanceof Error) {
      throw new SystemDeliveryUnavailableError(
        before === null || before instanceof Error ? before : after,
      )
    }
    const event = SystemAuditEventEntity.create({
      actorAccountId: accountId.data,
      action: systemDeliveryAuditActions[input.kind][input.action],
      targetType: input.kind === "job" ? "system:job" : "system:outbox_message",
      targetId: current.id,
      outcome: "succeeded",
      reasonCode: input.action === "fail" ? input.error_code : null,
      authorizationJson: null,
      beforeJson: before.toString(),
      afterJson: after.toString(),
      metadataJson: null,
      occurredAt: now,
    })
    if (event instanceof Error) throw new SystemDeliveryUnavailableError(event)
    const update = await repository.update(
      current,
      next,
      new SystemAuditEventRepository(systemContext).prepareAppend(event),
    )
    if (update instanceof Error) throw new SystemDeliveryUnavailableError(update)
    if (update === "conflict") throw new SystemDeliveryConflictError()

    return context.json(
      {
        delivery: systemDeliveryResponse(next),
        ...(rawLeaseToken === null ? {} : { lease_token: rawLeaseToken }),
      },
      200,
    )
  },
)
