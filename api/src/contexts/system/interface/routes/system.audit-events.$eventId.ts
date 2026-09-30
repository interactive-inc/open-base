import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { prepareSystemAuditDisclosure } from "@system/interface/operations/prepare-system-audit-disclosure"
import { systemAuditEventResponseSchema } from "@system/interface/http/audit-disclosure-response-schemas"
import {
  SystemAuditEventNotFoundError,
  SystemAuditUnavailableError,
  SystemForbiddenError,
} from "@system/interface/errors"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventQueryAdapter } from "@system/infrastructure/adapters/audit/system-audit-event-query.adapter"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** /system/audit-events/:eventId */

// @authorization permission audit:read - 一つのSystem監査イベントを開示条件に従って読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.object({ eventId: z.string().uuid() })),
  zValidator("query", z.object({ purpose: z.string().trim().min(1).max(100).optional() })),
  async (context) => {
    context.header("Cache-Control", "no-store")
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemAuditUnavailableError()
    }
    const eventId = context.req.valid("param").eventId
    const auditRepository = new SystemAuditEventRepository({ env: { DB: context.env.DB } })
    const authorizationJson = StableSystemAuditJsonValue.create({
      required_permission_keys: [SystemFeaturePermission.AUDIT_READ.key],
      purpose: context.req.valid("query").purpose ?? null,
    })
    if (authorizationJson instanceof Error) {
      throw new SystemAuditUnavailableError()
    }
    if (
      !context.var.permissions.has("system:admin") &&
      !context.var.permissions.has(SystemFeaturePermission.AUDIT_READ.key)
    ) {
      const deniedAudit = SystemAuditEventEntity.create({
        actorAccountId: context.var.userId,
        action: SYSTEM_AUDIT_ACTIONS.systemAuditDetail,
        targetType: "system:audit-event",
        targetId: eventId,
        outcome: "denied",
        reasonCode: "forbidden",
        authorizationJson: authorizationJson?.toString() ?? null,
        beforeJson: null,
        afterJson: null,
        metadataJson: null,
        occurredAt: now,
      })
      if (
        deniedAudit instanceof Error ||
        (await auditRepository.append(deniedAudit)) instanceof Error
      ) {
        throw new SystemAuditUnavailableError()
      }
      throw new SystemForbiddenError()
    }

    const disclosure = await prepareSystemAuditDisclosure(context, {
      permission: SystemFeaturePermission.AUDIT_READ.key,
      purpose: context.req.valid("query").purpose ?? null,
      now,
      action: SYSTEM_AUDIT_ACTIONS.systemAuditDetail,
      targetId: eventId,
    })
    const event = await new SystemAuditEventQueryAdapter({
      env: { DB: context.env.DB },
    }).findById(eventId, disclosure)
    if (event instanceof Error) {
      throw new SystemAuditUnavailableError()
    }
    const outcome = event === null ? "denied" : "succeeded"
    const readAudit = SystemAuditEventEntity.create({
      actorAccountId: context.var.userId,
      action: SYSTEM_AUDIT_ACTIONS.systemAuditDetail,
      targetType: "system:audit-event",
      targetId: eventId,
      outcome,
      reasonCode: event === null ? "not_found" : null,
      authorizationJson: authorizationJson?.toString() ?? null,
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt: now,
    })
    if (
      readAudit instanceof Error ||
      (await auditRepository.append(readAudit, disclosure.assertions)) instanceof Error
    ) {
      throw new SystemAuditUnavailableError()
    }
    if (event === null) {
      throw new SystemAuditEventNotFoundError()
    }

    return context.json(systemAuditEventResponseSchema.parse(event), 200)
  },
)
