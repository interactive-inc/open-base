import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemStepUpGrantEntity } from "@system/domain/entities/system-step-up-grant.entity"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemPasswordCredentialAdapter } from "@system/infrastructure/adapters/auth/system-password-credential.adapter"
import { RecordSystemIdentityLoginTokenAdapter } from "@system/infrastructure/adapters/auth/record-system-identity-login-token.adapter"
import { SystemIdentityLoginAdapter } from "@system/infrastructure/adapters/auth/system-identity-login.adapter"
import { SystemIdentityVerificationKeyAdapter } from "@system/infrastructure/adapters/auth/system-identity-verification-key.adapter"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemStepUpGrantRepository } from "@system/infrastructure/repositories/iam/system-step-up-grant.repository"
import { decoySystemPasswordHash } from "@system/lib/auth/decoy-system-password-hash"
import { passwordHashNeedsRehash } from "@system/lib/auth/password-hash-needs-rehash"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { SystemIdentityTokenVerifier } from "@system/lib/auth/system-identity-token-verifier"
import { verifySystemPassword } from "@system/lib/auth/verify-system-password"
import {
  SystemCredentialsInvalidError,
  SystemPrincipalUnavailableError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const STEP_UP_LIFETIME_MILLISECONDS = 5 * 60 * 1_000
const EXTERNAL_IDENTITY_FRESHNESS_MILLISECONDS = 5 * 60 * 1_000

const requestBody = z.union([
  z.object({ password: z.string().min(1).max(200) }).strict(),
  z.object({ method: z.literal("password"), password: z.string().min(1).max(200) }).strict(),
  z
    .object({ method: z.literal("external_identity"), token: z.string().min(1).max(4_096) })
    .strict(),
])

// @authorization authenticated - 現在のHuman Accountのpasswordを再検証して短命grantを発行する
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("json", requestBody),
  async (context) => {
    const now = context.var.now()
    const pepper = context.env.PEPPER_SECRET
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemPrincipalUnavailableError()
    }
    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) throw new SystemPrincipalUnavailableError(accountId.error)
    const body = context.req.valid("json")
    const method = "method" in body ? body.method : "password"
    if (!("method" in body) || body.method === "password") {
      if (pepper === undefined || pepper.length === 0) {
        throw new SystemPrincipalUnavailableError()
      }
      const authentication = await new SystemPasswordCredentialAdapter({
        database: context.env.DB,
      }).authenticateAccount(
        { accountId: accountId.data, password: body.password, now },
        {
          dummyHash: decoySystemPasswordHash,
          needsRehash: (passwordHash) => passwordHashNeedsRehash(passwordHash),
          verify: (password, passwordHash) => verifySystemPassword(password, passwordHash, pepper),
        },
      )
      if (authentication instanceof Error) {
        throw new SystemPrincipalUnavailableError(authentication)
      }
      if (authentication.kind === "rejected") throw new SystemCredentialsInvalidError()
    } else {
      const issuer = context.env.IDENTITY_ISSUER
      const audience = context.env.IDENTITY_AUDIENCE
      if (issuer === undefined || audience === undefined) {
        throw new SystemPrincipalUnavailableError()
      }
      const verificationKey = new SystemIdentityVerificationKeyAdapter({
        jwks: context.env.IDENTITY_JWKS,
        issuer,
      }).resolve()
      if (verificationKey instanceof Error) {
        throw new SystemPrincipalUnavailableError(verificationKey)
      }
      const claims = await new SystemIdentityTokenVerifier().verify({
        token: body.token,
        verificationKey,
        issuer,
        audience,
        now,
      })
      // token の発行時刻は更新でも新しくなるので、利用者が認証した時刻で新しさを判定する。
      // 認証時刻を載せない IdP の token は、再認証の証拠にならないので拒否する。
      const authenticatedAt =
        "reason" in claims || claims.auth_time === undefined ? Number.NaN : claims.auth_time * 1_000
      if (
        "reason" in claims ||
        !claims.email_verified ||
        !Number.isSafeInteger(authenticatedAt) ||
        authenticatedAt > now.getTime() ||
        now.getTime() - authenticatedAt > EXTERNAL_IDENTITY_FRESHNESS_MILLISECONDS
      ) {
        throw new SystemCredentialsInvalidError()
      }
      const login = await new SystemIdentityLoginAdapter({ env: { DB: context.env.DB } }).find(
        "oidc",
        claims.sub,
      )
      if (login instanceof Error) throw new SystemPrincipalUnavailableError(login)
      if (
        login === null ||
        login.account.id !== accountId.data ||
        login.account.status !== "active"
      ) {
        throw new SystemCredentialsInvalidError()
      }
      const replay = await new RecordSystemIdentityLoginTokenAdapter({
        env: { DB: context.env.DB },
      }).recordSystemIdentityLoginToken({
        jti: claims.jti,
        expiresAt: new Date(claims.exp * 1_000),
        usedAt: now,
      })
      if (replay instanceof Error) throw new SystemPrincipalUnavailableError(replay)
      if (replay === "replayed") throw new SystemCredentialsInvalidError()
    }

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

    return context.json(
      { step_up_token: rawToken, method, expires_at: expiresAt.toISOString() },
      201,
    )
  },
)
