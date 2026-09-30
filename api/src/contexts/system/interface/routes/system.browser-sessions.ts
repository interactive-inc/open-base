import { readSystemSessionMaxLifetimeMilliseconds } from "@system/lib/auth/read-system-session-max-lifetime"
import {
  SystemBrowserLoginCodeUnavailableError,
  SystemLoginCodeInvalidError,
} from "@system/interface/errors"
/** /system/browser-sessions */
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { IssueSystemSession } from "@system/application/auth/issue-system-session"
import { ConsumeSystemBrowserLoginCodeAdapter } from "@system/infrastructure/adapters/auth/consume-system-browser-login-code.adapter"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { systemLoginCodeHash } from "@system/lib/auth/system-login-code-hash"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import { SystemSessionMaterialService } from "@system/lib/auth/system-session-material-service"
import { SystemSessionRepository } from "@system/infrastructure/repositories/auth/system-session.repository"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - one-time code自体をcredentialとしてSystem Sessionへ交換する
export const POST = systemFactory.createHandlers(
  zValidator("json", z.object({ code: z.string().min(1).max(200) })),
  async (context) => {
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemBrowserLoginCodeUnavailableError()
    }

    const codeHash = await systemLoginCodeHash(context.req.valid("json").code)
    if (codeHash instanceof Error) {
      throw new SystemBrowserLoginCodeUnavailableError()
    }
    const consumed = await new ConsumeSystemBrowserLoginCodeAdapter({
      env: { DB: context.env.DB },
    }).consumeSystemBrowserLoginCode(codeHash, now)
    if (consumed instanceof Error) {
      throw new SystemBrowserLoginCodeUnavailableError()
    }
    if (consumed === null) {
      throw new SystemLoginCodeInvalidError()
    }

    const account = await new SystemAccountRepository({ database: context.env.DB }).find(
      consumed.accountId,
    )
    if (account instanceof Error) {
      throw new SystemBrowserLoginCodeUnavailableError()
    }
    if (account === null || account.status !== "active") {
      throw new SystemLoginCodeInvalidError()
    }

    const sessionTtlMilliseconds = Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000
    const sessionMaxLifetimeMilliseconds = readSystemSessionMaxLifetimeMilliseconds(
      context.env.SYSTEM_SESSION_MAX_LIFETIME_SECONDS,
    )
    const metadataJson = StableSystemAuditJsonValue.create({
      transport: "system.browser-sessions",
    })
    if (
      !Number.isSafeInteger(sessionTtlMilliseconds) ||
      sessionTtlMilliseconds <= 0 ||
      sessionMaxLifetimeMilliseconds instanceof Error ||
      metadataJson instanceof Error
    ) {
      throw new SystemBrowserLoginCodeUnavailableError()
    }

    const systemContext = { env: { DB: context.env.DB } }
    const issuance = await new IssueSystemSession({
      accountRepository: new SystemAccountRepository({ database: context.env.DB }),
      sessionRepository: new SystemSessionRepository({ context: systemContext }),
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
    if (issuance instanceof Error) {
      throw new SystemBrowserLoginCodeUnavailableError()
    }
    if (issuance.kind === "rejected") {
      throw new SystemLoginCodeInvalidError()
    }

    return context.json(
      {
        account_id: issuance.accountId,
        access_token: issuance.accessToken,
        refresh_token: issuance.rawToken,
        session_id: issuance.sessionId,
        expires_at: issuance.expiresAt.toISOString(),
      },
      201,
    )
  },
)
