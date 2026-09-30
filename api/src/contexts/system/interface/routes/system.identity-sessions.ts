import { readSystemSessionMaxLifetimeMilliseconds } from "@system/lib/auth/read-system-session-max-lifetime"
import {
  SystemIdentityLoginDeniedError,
  SystemIdentityLoginUnavailableError,
} from "@system/interface/errors"
/** /system/identity-sessions */
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { IssueSystemIdentitySession } from "@system/application/auth/issue-system-identity-session"
import { SystemIdentityLoginAuditAdapter } from "@system/infrastructure/adapters/audit/system-identity-login-audit.adapter"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import { RecordSystemIdentityLoginTokenAdapter } from "@system/infrastructure/adapters/auth/record-system-identity-login-token.adapter"
import { SystemIdentityLoginAdapter } from "@system/infrastructure/adapters/auth/system-identity-login.adapter"
import { SystemIdentityVerificationKeyAdapter } from "@system/infrastructure/adapters/auth/system-identity-verification-key.adapter"
import { SystemSessionRepository } from "@system/infrastructure/repositories/auth/system-session.repository"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { SystemIdentityTokenVerifier } from "@system/lib/auth/system-identity-token-verifier"
import { SystemSessionMaterialService } from "@system/lib/auth/system-session-material-service"
import { SystemSessionIssuanceAdapter } from "@system/infrastructure/adapters/auth/system-session-issuance.adapter"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - 外部Identity token自体をcredentialとしてSystem Sessionへ交換する
export const POST = systemFactory.createHandlers(
  zValidator("json", z.object({ token: z.string().min(1).max(4_096) })),
  async (context) => {
    const issuer = context.env.IDENTITY_ISSUER
    const audience = context.env.IDENTITY_AUDIENCE
    const sessionMaxLifetimeMilliseconds = readSystemSessionMaxLifetimeMilliseconds(
      context.env.SYSTEM_SESSION_MAX_LIFETIME_SECONDS,
    )
    if (
      sessionMaxLifetimeMilliseconds instanceof Error ||
      issuer === undefined ||
      issuer.length === 0 ||
      audience === undefined ||
      audience.length === 0
    ) {
      throw new SystemIdentityLoginUnavailableError()
    }

    const result = await new IssueSystemIdentitySession({
      identityIssuer: issuer,
      identityAudience: audience,
      verificationKeyRepository: new SystemIdentityVerificationKeyAdapter({
        jwks: context.env.IDENTITY_JWKS,
        issuer,
      }),
      tokenVerifier: new SystemIdentityTokenVerifier(),
      loginTokenRepository: new RecordSystemIdentityLoginTokenAdapter({
        env: { DB: context.env.DB },
      }),
      identityLoginRepository: new SystemIdentityLoginAdapter({
        env: { DB: context.env.DB },
      }),
      sessionIssuer: new SystemSessionIssuanceAdapter({
        accountRepository: new SystemAccountRepository({ database: context.env.DB }),
        sessionRepository: new SystemSessionRepository({
          context: { env: { DB: context.env.DB } },
        }),
        materialService: new SystemSessionMaterialService(),
        accessTokenIssuer: new SystemAccessTokenIssuer(context.env.JWT_SECRET ?? ""),
        sessionTtlMilliseconds: Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000,
        sessionMaxLifetimeMilliseconds,
      }),
      loginAuditRepository: new SystemIdentityLoginAuditAdapter({
        env: { DB: context.env.DB },
      }),
    }).issue(context.req.valid("json").token, context.var.now())
    if (result.kind === "unavailable") {
      throw new SystemIdentityLoginUnavailableError()
    }
    if (result.kind === "rejected") {
      throw new SystemIdentityLoginDeniedError()
    }

    return context.json(
      {
        account_id: result.accountId,
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        session_id: result.sessionId,
        expires_at: result.expiresAt.toISOString(),
      },
      201,
    )
  },
)
