import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { LoginRateLimitAdapter } from "@system/infrastructure/adapters/auth/login-rate-limit.adapter"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemMachineCredentialRepository } from "@system/infrastructure/repositories/iam/system-machine-credential.repository"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import {
  SystemAuthenticationRateLimitedError,
  SystemCredentialsInvalidError,
  SystemPrincipalUnavailableError,
} from "@system/interface/errors"
import { zValidator } from "@hono/zod-validator"
import { drizzle } from "drizzle-orm/d1"
import { createFactory } from "hono/factory"
import { z } from "zod"

type Environment = Readonly<{
  Bindings: Readonly<{
    DB?: D1Database
    JWT_SECRET?: string
    NOW?: string | number
  }>
}>

const factory = createFactory<Environment>()

// @authorization public - bodyの機械credentialを検証して短命access tokenだけを発行する
export const POST = factory.createHandlers(
  zValidator(
    "json",
    z
      .object({
        credential_id: z.string().regex(/^\S{1,255}$/),
        secret: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .strict(),
  ),
  async (context) => {
    const database = context.env.DB
    const now = new Date(context.env.NOW ?? Date.now())
    if (database === undefined || !Number.isSafeInteger(now.getTime())) {
      throw new SystemPrincipalUnavailableError()
    }
    const body = context.req.valid("json")
    const rateLimit = new LoginRateLimitAdapter({
      var: { database: drizzle(database, { schema: systemCoreSchema }), now: () => now },
    })
    const gate = await rateLimit.recordAndCheck({
      identifier: body.credential_id,
      ip: context.req.header("CF-Connecting-IP") ?? null,
      now: now.getTime(),
    })
    if (gate.limited) throw new SystemAuthenticationRateLimitedError()
    const secretHash = await new SystemPrincipalSecretService().hashRawSecret(body.secret)
    if (secretHash instanceof Error) throw new SystemPrincipalUnavailableError(secretHash)
    const metadata = StableSystemAuditJsonValue.create({
      client_ip: context.req.header("CF-Connecting-IP") ?? null,
      transport: "system.machine_sessions",
    })
    if (metadata === null || metadata instanceof Error) {
      throw new SystemPrincipalUnavailableError(metadata)
    }
    const systemContext = { env: { DB: database } }
    const authentication = await new SystemMachineCredentialRepository(systemContext).authenticate(
      body.credential_id,
      secretHash,
      now,
      (accountId) => {
        const event = SystemAuditEventEntity.create({
          actorAccountId: accountId,
          action: SYSTEM_AUDIT_ACTIONS.authMachineTokenIssued,
          targetType: "system:machine_credential",
          targetId: body.credential_id,
          outcome: "succeeded",
          reasonCode: null,
          authorizationJson: null,
          beforeJson: null,
          afterJson: null,
          metadataJson: metadata.toString(),
          occurredAt: now,
        })
        return event instanceof Error
          ? event
          : new SystemAuditEventRepository(systemContext).prepareAppend(event)
      },
    )
    if (authentication instanceof Error) throw new SystemPrincipalUnavailableError(authentication)
    if (authentication.kind === "rejected") throw new SystemCredentialsInvalidError()

    await rateLimit.resetForIdentifier({ identifier: body.credential_id })
    const accessToken = await new SystemAccessTokenIssuer(context.env.JWT_SECRET ?? "").issue({
      accountId: authentication.accountId,
      tokenVersion: authentication.tokenVersion,
      machineCredentialId: authentication.credentialId,
      now,
    })
    if (accessToken instanceof Error) throw new SystemPrincipalUnavailableError(accessToken)

    return context.json(
      {
        account_id: authentication.accountId,
        access_token: accessToken,
        token_type: "Bearer" as const,
      },
      201,
    )
  },
)
