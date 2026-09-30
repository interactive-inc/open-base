import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemMachineCredentialEntity } from "@system/domain/entities/system-machine-credential.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemMachineCredentialRepository } from "@system/infrastructure/repositories/iam/system-machine-credential.repository"
import { SystemPrincipalRepository } from "@system/infrastructure/repositories/iam/system-principal.repository"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"
import {
  SystemForbiddenError,
  SystemPrincipalConflictError,
  SystemPrincipalInvalidError,
  SystemPrincipalNotFoundError,
  SystemPrincipalUnavailableError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { systemMachineCredentialResponse } from "@system/interface/responses/system-machine-credential-response"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const params = z.object({ principalId: z.string().regex(/^\S{1,255}$/) }).strict()

// @authorization permission iam:read - raw secretを含まない機械credential metadataを読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", params),
  async (context) => {
    if (!authorizeSystemOperation(context.var.permissions, "iam:read", context.var.now())) {
      throw new SystemForbiddenError()
    }
    const principalId = context.req.valid("param").principalId
    const principal = await new SystemPrincipalRepository({
      env: { DB: context.env.DB },
    }).find({ principalId })
    if (principal instanceof Error) throw new SystemPrincipalUnavailableError(principal)
    if (principal === null) throw new SystemPrincipalNotFoundError()
    const credentials = await new SystemMachineCredentialRepository({
      env: { DB: context.env.DB },
    }).findMany(principalId)
    if (credentials instanceof Error) throw new SystemPrincipalUnavailableError(credentials)

    return context.json({ credentials: credentials.map(systemMachineCredentialResponse) }, 200)
  },
)

// @authorization permission iam:write - step-up後に機械credentialを発行しraw secretを一度だけ返す
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("param", params),
  zValidator(
    "json",
    z
      .object({
        name: z.string().trim().min(1).max(200),
        expires_at: z.iso.datetime({ offset: true }).nullable(),
        reason: z.string().trim().min(1).max(200),
      })
      .strict(),
  ),
  async (context) => {
    const now = context.var.now()
    if (!authorizeSystemOperation(context.var.permissions, "iam:write", now)) {
      throw new SystemForbiddenError()
    }
    const principalId = context.req.valid("param").principalId
    const principal = await new SystemPrincipalRepository({
      env: { DB: context.env.DB },
    }).find({ principalId })
    if (principal instanceof Error) throw new SystemPrincipalUnavailableError(principal)
    if (principal === null) throw new SystemPrincipalNotFoundError()
    if (principal.kind === "human") throw new SystemPrincipalInvalidError()

    const body = context.req.valid("json")
    const expiresAt = body.expires_at === null ? null : new Date(body.expires_at)
    const material = new SystemPrincipalSecretService()
    const rawSecret = material.generateRawSecret()
    if (rawSecret instanceof Error) throw new SystemPrincipalUnavailableError(rawSecret)
    const secretHash = await material.hashRawSecret(rawSecret)
    if (secretHash instanceof Error) throw new SystemPrincipalUnavailableError(secretHash)
    const credential = SystemMachineCredentialEntity.create({
      id: crypto.randomUUID(),
      principalId,
      name: body.name,
      secretHash,
      status: "active",
      createdAt: now,
      updatedAt: now,
      expiresAt,
      lastUsedAt: null,
      revokedAt: null,
    })
    if (credential instanceof Error) throw new SystemPrincipalInvalidError(credential)
    const after = StableSystemAuditJsonValue.create(systemMachineCredentialResponse(credential))
    if (after === null || after instanceof Error) throw new SystemPrincipalUnavailableError(after)
    const event = SystemAuditEventEntity.create({
      actorAccountId: context.var.userId,
      action: SYSTEM_AUDIT_ACTIONS.authMachineCredentialCreated,
      targetType: "system:machine_credential",
      targetId: credential.id,
      outcome: "succeeded",
      reasonCode: body.reason,
      authorizationJson: null,
      beforeJson: null,
      afterJson: after.toString(),
      metadataJson: null,
      occurredAt: now,
    })
    if (event instanceof Error) throw new SystemPrincipalUnavailableError(event)
    const systemContext = { env: { DB: context.env.DB } }
    const creation = await new SystemMachineCredentialRepository(systemContext).create(
      credential,
      new SystemAuditEventRepository(systemContext).prepareAppend(event),
    )
    if (creation instanceof Error) throw new SystemPrincipalUnavailableError(creation)
    if (creation === "conflict") throw new SystemPrincipalConflictError()

    return context.json(
      { credential: systemMachineCredentialResponse(credential), secret: rawSecret },
      201,
    )
  },
)
