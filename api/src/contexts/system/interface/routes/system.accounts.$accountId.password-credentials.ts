import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import {
  SystemForbiddenError,
  SystemInvalidSessionError,
  SystemPasswordCredentialNotFoundError,
  SystemPasswordInvalidError,
  SystemPasswordUnavailableError,
} from "@system/interface/errors"
/** /system/accounts/:accountId/password-credentials */
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemPasswordValue } from "@system/domain/values/auth/system-password.value"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { hashPassword } from "@system/lib/auth/hash-password"
import { SystemPasswordResetAdapter } from "@system/infrastructure/adapters/auth/system-password-reset.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission iam:write - credential変更・token失効・監査を同じtransactionで確定する
export const PATCH = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("json", z.object({ password: z.string().min(12).max(200) }).strict()),
  async (context) => {
    if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
      throw new SystemForbiddenError()
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const targetAccountId = zAccountId.safeParse(context.req.param("accountId"))
    if (!actorAccountId.success) {
      throw new SystemInvalidSessionError()
    }
    if (!targetAccountId.success) {
      throw new SystemPasswordCredentialNotFoundError()
    }
    const body = context.req.valid("json")
    if (!(SystemPasswordValue.create(body.password) instanceof SystemPasswordValue)) {
      throw new SystemPasswordInvalidError()
    }
    const pepper = context.env.PEPPER_SECRET
    if (pepper === undefined || pepper.length === 0) {
      throw new SystemPasswordUnavailableError()
    }
    const repository = new SystemPasswordResetAdapter({
      env: { DB: context.env.DB },
    })
    const identityId = await repository.findIdentityId(targetAccountId.data)
    if (identityId instanceof Error) {
      throw new SystemPasswordUnavailableError()
    }
    if (identityId === null) {
      throw new SystemPasswordCredentialNotFoundError()
    }
    const passwordHash = await hashPassword(body.password, pepper).catch((caught: unknown) =>
      caught instanceof Error ? caught : new Error("failed to hash System password"),
    )
    if (passwordHash instanceof Error) {
      console.error(
        JSON.stringify({ event: "system_password_reset_hash_failed", error: passwordHash.name }),
      )
      throw new SystemPasswordUnavailableError()
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemPasswordUnavailableError()
    }
    const afterJson = StableSystemAuditJsonValue.create({ changed_at: now.toISOString() })
    if (afterJson instanceof Error) {
      throw new SystemPasswordUnavailableError()
    }
    const auditEvent = SystemAuditEventEntity.create({
      actorAccountId: actorAccountId.data,
      action: SYSTEM_AUDIT_ACTIONS.systemPasswordCredentialReset,
      targetType: "system:identity",
      targetId: identityId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: afterJson?.toString() ?? null,
      metadataJson: null,
      occurredAt: now,
    })
    if (auditEvent instanceof Error) {
      throw new SystemPasswordUnavailableError()
    }
    const auditStatements = new SystemAuditEventRepository({
      env: { DB: context.env.DB },
    }).prepareAppend(auditEvent)
    const reset = await repository.reset({
      actorAccountId: actorAccountId.data,
      targetAccountId: targetAccountId.data,
      identityId,
      passwordHash,
      now,
      auditStatements,
    })
    if (reset instanceof Error) {
      throw new SystemPasswordUnavailableError()
    }
    if (reset === "forbidden") {
      throw new SystemForbiddenError()
    }
    if (reset === "not_found") {
      throw new SystemPasswordCredentialNotFoundError()
    }

    return context.body(null, 204)
  },
)
