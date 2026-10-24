import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemStepUpGrantEntity } from "@system/domain/entities/system-step-up-grant.entity"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemStepUpGrantRepository } from "@system/infrastructure/repositories/iam/system-step-up-grant.repository"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import {
  SystemCredentialsInvalidError,
  SystemPrincipalUnavailableError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { SystemSignedInSessionChannel } from "@system/interface/request-environment/system-signed-in-session-channel"

const STEP_UP_LIFETIME_MILLISECONDS = 5 * 60 * 1_000
const PASSKEY_FRESHNESS_MILLISECONDS = 5 * 60 * 1_000

// @authorization authenticated - 直前にパスキーでサインインした本人のセッションだけに短命grantを発行する
export const POST = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  const now = context.var.now()
  if (!Number.isSafeInteger(now.getTime())) {
    throw new SystemPrincipalUnavailableError()
  }
  const accountId = zAccountId.safeParse(context.var.userId)
  if (!accountId.success) throw new SystemPrincipalUnavailableError(accountId.error)
  // 再認証はパスキーでサインインし直して行う。デバイス認証のセッションや古いセッションは証拠にならない。
  const session = new SystemSignedInSessionChannel({ env: context.env }).read()
  const authenticatedAt = session?.authenticatedAt.getTime() ?? Number.NaN
  if (
    session === null ||
    session.method !== "passkey" ||
    session.accountId !== accountId.data ||
    !Number.isSafeInteger(authenticatedAt) ||
    authenticatedAt > now.getTime() ||
    now.getTime() - authenticatedAt > PASSKEY_FRESHNESS_MILLISECONDS
  ) {
    throw new SystemCredentialsInvalidError()
  }
  const method = "passkey"

  const material = new SystemPrincipalSecretService()
  const rawToken = material.generateRawSecret()
  if (rawToken instanceof Error) throw new SystemPrincipalUnavailableError(rawToken)
  const tokenHash = await material.hashRawSecret(rawToken)
  if (tokenHash instanceof Error) throw new SystemPrincipalUnavailableError(tokenHash)
  const expiresAt = new Date(now.getTime() + STEP_UP_LIFETIME_MILLISECONDS)
  const metadata = StableSystemAuditJsonValue.create({
    expires_at: expiresAt.toISOString(),
    method,
  })
  if (metadata === null || metadata instanceof Error) {
    throw new SystemPrincipalUnavailableError(metadata)
  }
  const event = SystemAuditEventEntity.create({
    actorAccountId: context.var.userId,
    action: SYSTEM_AUDIT_ACTIONS.authStepUpIssued,
    targetType: "system:account",
    targetId: context.var.userId,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: null,
    metadataJson: metadata.toString(),
    occurredAt: now,
  })
  if (event instanceof Error) throw new SystemPrincipalUnavailableError(event)
  const grant = SystemStepUpGrantEntity.create({
    id: crypto.randomUUID(),
    accountId: accountId.data,
    tokenHash,
    method,
    issuedAt: now,
    expiresAt,
  })
  if (grant instanceof Error) throw new SystemPrincipalUnavailableError(grant)
  const systemContext = { env: { DB: context.env.DB } }
  const result = await new SystemStepUpGrantRepository(systemContext).create(
    grant,
    new SystemAuditEventRepository(systemContext).prepareAppend(event),
  )
  if (result instanceof Error) throw new SystemPrincipalUnavailableError(result)

  return context.json({ step_up_token: rawToken, method, expires_at: expiresAt.toISOString() }, 201)
})
