import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import type { SystemSessionIssuer } from "@system/domain/definitions/auth/system-session-issuance.definition"
import type { SystemIdentityLoginAuditAdapter } from "@system/infrastructure/adapters/audit/system-identity-login-audit.adapter"
import type { RecordSystemIdentityLoginTokenAdapter } from "@system/infrastructure/adapters/auth/record-system-identity-login-token.adapter"
import type { SystemIdentityLoginAdapter } from "@system/infrastructure/adapters/auth/system-identity-login.adapter"
import type { SystemIdentityTokenVerifier } from "@system/lib/auth/system-identity-token-verifier"
import type { SystemIdentityVerificationKeyAdapter } from "@system/infrastructure/adapters/auth/system-identity-verification-key.adapter"

type Props = Readonly<{
  identityIssuer: string
  identityAudience: string
  verificationKeyRepository: Pick<SystemIdentityVerificationKeyAdapter, "resolve">
  tokenVerifier: Pick<SystemIdentityTokenVerifier, "verify">
  loginTokenRepository: Pick<
    RecordSystemIdentityLoginTokenAdapter,
    "recordSystemIdentityLoginToken"
  >
  identityLoginRepository: Pick<SystemIdentityLoginAdapter, "find">
  sessionIssuer: SystemSessionIssuer
  loginAuditRepository: Pick<SystemIdentityLoginAuditAdapter, "recordDenied">
}>

export type SystemIdentitySessionIssuance =
  | Readonly<{
      kind: "issued"
      accountId: string
      accessToken: string
      refreshToken: string
      sessionId: string
      expiresAt: Date
    }>
  | Readonly<{
      kind: "rejected"
      reason:
        | "invalid_token"
        | "email_unverified"
        | "token_replayed"
        | "account_not_found"
        | "account_inactive"
    }>
  | Readonly<{ kind: "unavailable" }>
type IssueSystemIdentitySessionContext = Props
type Context = IssueSystemIdentitySessionContext

/** 外部IDでシステムセッションを発行する。 */
export class IssueSystemIdentitySession {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async issue(token: string, now: Date): Promise<SystemIdentitySessionIssuance> {
    if (
      !Number.isSafeInteger(now.getTime()) ||
      this.c.identityIssuer.length === 0 ||
      this.c.identityAudience.length === 0
    ) {
      return { kind: "unavailable" }
    }
    const verificationKey = this.c.verificationKeyRepository.resolve()
    if (verificationKey instanceof Error) return { kind: "unavailable" }

    const claims = await this.c.tokenVerifier.verify({
      token,
      verificationKey,
      issuer: this.c.identityIssuer,
      audience: this.c.identityAudience,
      now,
    })
    if ("reason" in claims) return await this.reject("invalid_token", now)
    if (claims.email_verified !== true) return await this.reject("email_unverified", now)

    const replay = await this.c.loginTokenRepository.recordSystemIdentityLoginToken({
      jti: claims.jti,
      expiresAt: new Date(claims.exp * 1_000),
      usedAt: now,
    })
    if (replay instanceof Error) return { kind: "unavailable" }
    if (replay === "replayed") return await this.reject("token_replayed", now)

    const login = await this.c.identityLoginRepository.find("oidc", claims.sub)
    if (login instanceof Error) return { kind: "unavailable" }
    if (login === null) return await this.reject("account_not_found", now)
    if (login.account.status !== "active") return await this.reject("account_inactive", now)

    const metadataJson = StableSystemAuditJsonValue.create({
      transport: "system.identity-sessions",
    })
    if (metadataJson instanceof Error) return { kind: "unavailable" }
    const issuance = await this.c.sessionIssuer.issue({
      accountId: login.account.id,
      tokenVersion: login.account.tokenVersion,
      now,
      auditContext: { authorizationJson: null, metadataJson: metadataJson?.toString() ?? null },
    })
    if (issuance instanceof Error) return { kind: "unavailable" }
    if (issuance.kind === "rejected") return await this.reject("account_inactive", now)

    return Object.freeze({
      kind: "issued",
      accountId: issuance.accountId,
      accessToken: issuance.accessToken,
      refreshToken: issuance.rawToken,
      sessionId: issuance.sessionId,
      expiresAt: issuance.expiresAt,
    })
  }

  private async reject(
    reason: Extract<SystemIdentitySessionIssuance, { kind: "rejected" }>["reason"],
    now: Date,
  ): Promise<SystemIdentitySessionIssuance> {
    const audit = await this.c.loginAuditRepository.recordDenied(reason, now)

    return audit instanceof Error ? { kind: "unavailable" } : { kind: "rejected", reason }
  }
}
