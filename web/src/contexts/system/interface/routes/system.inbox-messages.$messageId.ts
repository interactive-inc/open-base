import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemDeliveryRepository } from "@system/infrastructure/repositories/events/system-delivery.repository"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"
import {
  SystemDeliveryConflictError,
  SystemDeliveryNotFoundError,
  SystemDeliveryUnavailableError,
  SystemForbiddenError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission integration:write - inboxを処理済みまたは拒否へ一度だけ確定する
export const PATCH = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.object({ messageId: z.string().regex(/^\S{1,255}$/) }).strict()),
  zValidator(
    "json",
    z.discriminatedUnion("outcome", [
      z.object({ outcome: z.literal("processed") }).strict(),
      z
        .object({
          outcome: z.literal("rejected"),
          reason_code: z.string().regex(/^[a-z][a-z0-9_.:-]{0,199}$/),
        })
        .strict(),
    ]),
  ),
  async (context) => {
    const now = context.var.now()
    if (!authorizeSystemOperation(context.var.permissions, "integration:write", now)) {
      throw new SystemForbiddenError()
    }
    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) throw new SystemDeliveryUnavailableError(accountId.error)
    const input = context.req.valid("json")
    const messageId = context.req.valid("param").messageId
    const after = StableSystemAuditJsonValue.create({
      outcome: input.outcome,
      reason_code: input.outcome === "rejected" ? input.reason_code : null,
    })
    if (after === null || after instanceof Error) throw new SystemDeliveryUnavailableError(after)
    const event = SystemAuditEventEntity.create({
      actorAccountId: accountId.data,
      action:
        input.outcome === "processed"
          ? SYSTEM_AUDIT_ACTIONS.systemInboxProcessed
          : SYSTEM_AUDIT_ACTIONS.systemInboxRejected,
      targetType: "system:inbox_message",
      targetId: messageId,
      outcome: "succeeded",
      reasonCode: input.outcome === "rejected" ? input.reason_code : null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: after.toString(),
      metadataJson: null,
      occurredAt: now,
    })
    if (event instanceof Error) throw new SystemDeliveryUnavailableError(event)
    const systemContext = { env: { DB: context.env.DB } }
    const result = await new SystemDeliveryRepository(systemContext).completeInbox(
      messageId,
      input.outcome,
      input.outcome === "rejected" ? input.reason_code : null,
      now,
      new SystemAuditEventRepository(systemContext).prepareAppend(event),
    )
    if (result instanceof Error) throw new SystemDeliveryUnavailableError(result)
    if (result === "not_found") throw new SystemDeliveryNotFoundError()
    if (result === "conflict") throw new SystemDeliveryConflictError()
    return context.body(null, 204)
  },
)
