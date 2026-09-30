import { readSystemSessionMaxLifetimeMilliseconds } from "@system/lib/auth/read-system-session-max-lifetime"
import { SystemCLICodeInvalidError, SystemCLILoginUnavailableError } from "@system/interface/errors"
/** /system/cli-sessions */
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAccessTokenSecretValue } from "@system/domain/values/auth/system-access-token-secret.value"
import { IssueSystemSession } from "@system/application/auth/issue-system-session"
import { ConsumeSystemCliLoginCodeAdapter } from "@system/infrastructure/adapters/auth/consume-system-cli-login-code.adapter"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import { systemLoginCodeHash } from "@system/lib/auth/system-login-code-hash"
import { SystemSessionMaterialService } from "@system/lib/auth/system-session-material-service"
import { SystemSessionRepository } from "@system/infrastructure/repositories/auth/system-session.repository"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - one-time CLI codeをcredentialとしてSystem Sessionへ交換する
export const POST = systemFactory.createHandlers(
  zValidator("json", z.object({ code: z.string().min(1).max(200) })),
  async (context) => {
    const now = context.var.now()
    const sessionTtlMilliseconds = Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000
    const sessionMaxLifetimeMilliseconds = readSystemSessionMaxLifetimeMilliseconds(
      context.env.SYSTEM_SESSION_MAX_LIFETIME_SECONDS,
    )
    const metadataJson = StableSystemAuditJsonValue.create({ transport: "system.cli-sessions" })
    if (
      metadataJson instanceof Error ||
      !Number.isSafeInteger(sessionTtlMilliseconds) ||
      sessionTtlMilliseconds <= 0 ||
      sessionMaxLifetimeMilliseconds instanceof Error ||
      !(
        SystemAccessTokenSecretValue.create(context.env.JWT_SECRET ?? "") instanceof
        SystemAccessTokenSecretValue
      )
    ) {
      throw new SystemCLILoginUnavailableError()
    }

    const codeHash = await systemLoginCodeHash(context.req.valid("json").code)
    if (codeHash instanceof Error) {
      throw new SystemCLILoginUnavailableError()
    }

    const consumed = await new ConsumeSystemCliLoginCodeAdapter(context).consumeSystemCliLoginCode(
      codeHash,
      now,
    )
    if (consumed instanceof Error) {
      throw new SystemCLILoginUnavailableError()
    }
    if (consumed === null) {
      throw new SystemCLICodeInvalidError()
    }

    const account = await new SystemAccountRepository({ database: context.env.DB }).find(
      consumed.accountId,
    )
    if (account instanceof Error) {
      throw new SystemCLILoginUnavailableError()
    }
    if (account === null || account.status !== "active") {
      throw new SystemCLICodeInvalidError()
    }
    const issued = await new IssueSystemSession({
      accountRepository: new SystemAccountRepository({ database: context.env.DB }),
      sessionRepository: new SystemSessionRepository({ context }),
      materialService: new SystemSessionMaterialService(),
      accessTokenIssuer: new SystemAccessTokenIssuer(context.env.JWT_SECRET ?? ""),
      sessionTtlMilliseconds,
      sessionMaxLifetimeMilliseconds,
    }).execute({
      accountId: account.id,
      tokenVersion: account.tokenVersion,
      now,
      auditContext: { authorizationJson: null, metadataJson: metadataJson?.toString() ?? null },
    })
    if (issued instanceof Error) {
      throw new SystemCLILoginUnavailableError()
    }
    if (issued.kind === "rejected") {
      throw new SystemCLICodeInvalidError()
    }

    return context.json(
      {
        account_id: issued.accountId,
        access_token: issued.accessToken,
        refresh_token: issued.rawToken,
        session_id: issued.sessionId,
        expires_at: issued.expiresAt.toISOString(),
      },
      201,
    )
  },
)
