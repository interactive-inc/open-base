import {
  SystemAuthenticationRateLimitedError,
  SystemCredentialsInvalidError,
  SystemInvalidSessionError,
  SystemSessionUnavailableError,
} from "@system/interface/errors"
/** /system/sessions */
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { readSystemSessionMaxLifetimeMilliseconds } from "@system/lib/auth/read-system-session-max-lifetime"
import { IssueSystemSession } from "@system/application/auth/issue-system-session"
import { RevokeSystemSession } from "@system/application/auth/revoke-system-session"
import { RotateSystemSession } from "@system/application/auth/rotate-system-session"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import { SystemSessionMaterialService } from "@system/lib/auth/system-session-material-service"
import { SystemSessionRepository } from "@system/infrastructure/repositories/auth/system-session.repository"
import { decoySystemPasswordHash } from "@system/lib/auth/decoy-system-password-hash"
import { LoginRateLimitAdapter } from "@system/infrastructure/adapters/auth/login-rate-limit.adapter"
import { passwordHashNeedsRehash } from "@system/lib/auth/password-hash-needs-rehash"
import { SystemPasswordLoginAuditAdapter } from "@system/infrastructure/adapters/audit/system-password-login-audit.adapter"
import { SystemPasswordCredentialAdapter } from "@system/infrastructure/adapters/auth/system-password-credential.adapter"
import { verifySystemPassword } from "@system/lib/auth/verify-system-password"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { zValidator } from "@hono/zod-validator"
import { drizzle } from "drizzle-orm/d1"
import { createFactory } from "hono/factory"
import { z } from "zod"

export type SystemSessionHttpEnvironment = {
  Bindings: {
    DB?: D1Database
    NOW?: string | number
    PEPPER_SECRET?: string
    JWT_SECRET?: string
    SYSTEM_SESSION_TTL_SECONDS?: string
    SYSTEM_SESSION_MAX_LIFETIME_SECONDS?: string
  }
}

const factory = createFactory<SystemSessionHttpEnvironment>()

// @authorization public - password credentialを検証しcanonical opaque Sessionを発行する
export const POST = factory.createHandlers(
  zValidator(
    "json",
    z.object({
      subject: z
        .string()
        .trim()
        .toLowerCase()
        .email()
        .min(1)
        .max(255)
        .regex(/^[\x20-\x7e]+$/)
        .brand<"IdentitySubject">(),
      password: z.string().min(1).max(200),
    }),
  ),
  async (context) => {
    const database = context.env?.DB
    const pepper = context.env?.PEPPER_SECRET
    if (database === undefined || pepper === undefined || pepper.length === 0) {
      throw new SystemSessionUnavailableError()
    }

    const now = new Date(context.env.NOW ?? Date.now())
    const sessionTtlMilliseconds = Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000
    const sessionMaxLifetimeMilliseconds = readSystemSessionMaxLifetimeMilliseconds(
      context.env.SYSTEM_SESSION_MAX_LIFETIME_SECONDS,
    )
    if (
      !Number.isSafeInteger(now.getTime()) ||
      !Number.isSafeInteger(sessionTtlMilliseconds) ||
      sessionMaxLifetimeMilliseconds instanceof Error
    ) {
      throw new SystemSessionUnavailableError()
    }

    const body = context.req.valid("json")
    const rateLimit = new LoginRateLimitAdapter({
      var: {
        database: drizzle(database, { schema: systemCoreSchema }),
        now: () => now,
      },
    })
    const gate = await rateLimit.recordAndCheck({
      identifier: body.subject,
      ip: context.req.header("CF-Connecting-IP") ?? null,
      now: now.getTime(),
    })
    if (gate.limited) {
      throw new SystemAuthenticationRateLimitedError()
    }

    const authentication = await new SystemPasswordCredentialAdapter({ database }).authenticate(
      { subject: body.subject, password: body.password, now },
      {
        dummyHash: decoySystemPasswordHash,
        needsRehash: (passwordHash) => passwordHashNeedsRehash(passwordHash),
        verify: (password, passwordHash) => verifySystemPassword(password, passwordHash, pepper),
      },
    )
    if (authentication instanceof Error) {
      throw new SystemSessionUnavailableError()
    }
    if (authentication.kind === "rejected") {
      // 未知subjectと誤passwordを同じreasonで監査し、監査不能ならfail closedにする。
      const audited = await new SystemPasswordLoginAuditAdapter({
        env: { DB: database },
      }).recordDenied("invalid_credentials", now)
      if (audited instanceof Error) {
        throw new SystemSessionUnavailableError()
      }
      throw new SystemCredentialsInvalidError()
    }

    await rateLimit.resetForIdentifier({ identifier: body.subject })
    const metadataJson = StableSystemAuditJsonValue.create({
      client_ip: context.req.header("CF-Connecting-IP") ?? null,
      transport: "system.sessions.password",
    })
    if (metadataJson instanceof Error) {
      throw new SystemSessionUnavailableError()
    }
    const systemContext = { env: { DB: database } }
    const issuance = await new IssueSystemSession({
      accountRepository: new SystemAccountRepository({ database }),
      sessionRepository: new SystemSessionRepository({ context: systemContext }),
      materialService: new SystemSessionMaterialService(),
      accessTokenIssuer: new SystemAccessTokenIssuer(context.env.JWT_SECRET ?? ""),
      sessionTtlMilliseconds,
      sessionMaxLifetimeMilliseconds,
    }).execute({
      accountId: authentication.accountId,
      tokenVersion: authentication.tokenVersion,
      now,
      auditContext: { authorizationJson: null, metadataJson: metadataJson?.toString() ?? null },
    })
    if (issuance instanceof Error) {
      throw new SystemSessionUnavailableError()
    }
    if (issuance.kind === "rejected") {
      // 未知subjectと誤passwordを同じreasonで監査し、監査不能ならfail closedにする。
      const audited = await new SystemPasswordLoginAuditAdapter({
        env: { DB: database },
      }).recordDenied("invalid_credentials", now)
      if (audited instanceof Error) {
        throw new SystemSessionUnavailableError()
      }
      throw new SystemCredentialsInvalidError()
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

// @authorization public - refresh tokenのrotationと再利用検知をSystemが行う
export const PATCH = factory.createHandlers(
  zValidator(
    "json",
    z.object({
      refresh_token: z
        .string()
        .length(64)
        .regex(/^[0-9a-f]+$/i),
    }),
  ),
  async (context) => {
    const database = context.env?.DB
    if (database === undefined) {
      throw new SystemSessionUnavailableError()
    }

    const now = new Date(context.env.NOW ?? Date.now())
    const sessionTtlMilliseconds = Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000
    const sessionMaxLifetimeMilliseconds = readSystemSessionMaxLifetimeMilliseconds(
      context.env.SYSTEM_SESSION_MAX_LIFETIME_SECONDS,
    )
    if (
      !Number.isSafeInteger(now.getTime()) ||
      !Number.isSafeInteger(sessionTtlMilliseconds) ||
      sessionMaxLifetimeMilliseconds instanceof Error
    ) {
      throw new SystemSessionUnavailableError()
    }

    const systemContext = { env: { DB: database } }
    const rotation = await new RotateSystemSession({
      accountRepository: new SystemAccountRepository({ database }),
      sessionRepository: new SystemSessionRepository({ context: systemContext }),
      auditAppender: new SystemAuditEventRepository(systemContext),
      materialService: new SystemSessionMaterialService(),
      accessTokenIssuer: new SystemAccessTokenIssuer(context.env.JWT_SECRET ?? ""),
      sessionTtlMilliseconds,
      sessionMaxLifetimeMilliseconds,
    }).execute({
      rawToken: context.req.valid("json").refresh_token,
      now,
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    if (rotation instanceof Error) {
      throw new SystemSessionUnavailableError()
    }
    if (rotation.kind === "rejected") {
      throw new SystemInvalidSessionError()
    }

    return context.json(
      {
        account_id: rotation.accountId,
        access_token: rotation.accessToken,
        refresh_token: rotation.rawToken,
        session_id: rotation.sessionId,
        expires_at: rotation.expiresAt.toISOString(),
      },
      200,
    )
  },
)

// @authorization public - tokenの実在を漏らさずSession familyを冪等失効する
export const DELETE = factory.createHandlers(
  zValidator(
    "json",
    z.object({
      refresh_token: z
        .string()
        .length(64)
        .regex(/^[0-9a-f]+$/i),
    }),
  ),
  async (context) => {
    const database = context.env?.DB
    if (database === undefined) {
      throw new SystemSessionUnavailableError()
    }

    const now = new Date(context.env.NOW ?? Date.now())
    const sessionTtlMilliseconds = Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000
    if (!Number.isSafeInteger(now.getTime()) || !Number.isSafeInteger(sessionTtlMilliseconds)) {
      throw new SystemSessionUnavailableError()
    }

    const systemContext = { env: { DB: database } }
    const revocation = await new RevokeSystemSession({
      sessionRepository: new SystemSessionRepository({ context: systemContext }),
      materialService: new SystemSessionMaterialService(),
    }).execute({
      rawToken: context.req.valid("json").refresh_token,
      now,
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    if (revocation instanceof Error) {
      throw new SystemSessionUnavailableError()
    }

    return context.body(null, 204)
  },
)
