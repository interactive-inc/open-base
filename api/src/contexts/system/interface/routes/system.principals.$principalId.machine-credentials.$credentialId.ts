import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemMachineCredentialRepository } from "@system/infrastructure/repositories/iam/system-machine-credential.repository"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"
import {
  SystemForbiddenError,
  SystemPrincipalNotFoundError,
  SystemPrincipalUnavailableError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const params = z
  .object({
    principalId: z.string().regex(/^\S{1,255}$/),
    credentialId: z.string().regex(/^\S{1,255}$/),
  })
  .strict()

// @authorization permission iam:write - step-up後にcredentialを失効し履歴を保持する
export const DELETE = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("param", params),
  zValidator("json", z.object({ reason: z.string().trim().min(1).max(200) }).strict()),
  async (context) => {
    const now = context.var.now()
    if (!authorizeSystemOperation(context.var.permissions, "iam:write", now)) {
      throw new SystemForbiddenError()
    }
    const identifiers = context.req.valid("param")
    const metadata = StableSystemAuditJsonValue.create({ status: "revoked" })
    if (metadata === null || metadata instanceof Error) {
      throw new SystemPrincipalUnavailableError(metadata)
    }
    const event = SystemAuditEventEntity.create({
      actorAccountId: context.var.userId,
      action: SYSTEM_AUDIT_ACTIONS.authMachineCredentialRevoked,
      targetType: "system:machine_credential",
      targetId: identifiers.credentialId,
      outcome: "succeeded",
      reasonCode: context.req.valid("json").reason,
      authorizationJson: null,
      beforeJson: null,
      afterJson: metadata.toString(),
      metadataJson: null,
      occurredAt: now,
    })
    if (event instanceof Error) throw new SystemPrincipalUnavailableError(event)
    const systemContext = { env: { DB: context.env.DB } }
    const result = await new SystemMachineCredentialRepository(systemContext).revoke(
      identifiers.principalId,
      identifiers.credentialId,
      now,
      new SystemAuditEventRepository(systemContext).prepareAppend(event),
    )
    if (result instanceof Error) throw new SystemPrincipalUnavailableError(result)
    if (result === "not_found") throw new SystemPrincipalNotFoundError()

    return context.body(null, 204)
  },
)
