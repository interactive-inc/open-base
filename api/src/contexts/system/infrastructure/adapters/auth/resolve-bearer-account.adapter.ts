import { ResolveExternalAccessTokenAccountAdapter } from "@system/infrastructure/adapters/auth/resolve-external-access-token-account.adapter"
import type {
  SystemD1Context,
  SystemExternalIdentityContext,
  SystemJwtSecretContext,
} from "@system/configuration/system-context"
import type { AccessTokenClaims } from "@system/domain/schemas/auth/access-token-claims.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAccessTokenSecretValue } from "@system/domain/values/auth/system-access-token-secret.value"
import { SystemAccessTokenStateAdapter } from "@system/infrastructure/adapters/auth/system-access-token-state.adapter"
import { AccessTokenService } from "@system/lib/auth/access-token-service"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/lib/auth/system-access-token-profile"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"

type Bindings = (SystemD1Context & SystemExternalIdentityContext & SystemJwtSecretContext)["env"]

export type BearerAccountResolution =
  | Readonly<{
      kind: "accepted"
      accountId: ReturnType<typeof zAccountId.parse>
      tokenVersion: number
      readAuthentication: SystemReadAuthentication
      systemAccessToken?: AccessTokenClaims
    }>
  | Readonly<{ kind: "rejected"; reason: string }>
  | Readonly<{ kind: "unavailable" }>

async function resolveSystemSession(props: {
  token: string
  env: Bindings
  now: Date
}): Promise<BearerAccountResolution> {
  const secret = SystemAccessTokenSecretValue.create(props.env.JWT_SECRET ?? "")
  if (!(secret instanceof SystemAccessTokenSecretValue)) return { kind: "unavailable" }

  const claims = await new AccessTokenService({ profile: SYSTEM_ACCESS_TOKEN_PROFILE }).verify(
    props.token,
    secret.toString(),
    new Date(),
  )
  if (claims instanceof Error) return { kind: "rejected", reason: "invalid token" }

  const accountId = zAccountId.safeParse(claims.sub)
  if (!accountId.success) return { kind: "rejected", reason: "invalid token" }

  const authentication = await new SystemAccessTokenStateAdapter({
    database: props.env.DB,
  }).resolve({
    accountId: accountId.data,
    tokenVersion: claims.ver,
    issuedAtMs: claims.issuedAtMs,
    machineCredentialId: claims.machineCredentialId,
    sessionFamilyId: claims.sid ?? null,
    at: props.now,
  })
  if (authentication instanceof Error) return { kind: "unavailable" }
  if (authentication.kind === "accepted") {
    return {
      kind: "accepted",
      accountId: accountId.data,
      tokenVersion: authentication.account.tokenVersion,
      systemAccessToken: claims,
      readAuthentication: {
        accountId: accountId.data,
        tokenVersion: authentication.account.tokenVersion,
        issuedAtMs: claims.issuedAtMs,
        expiresAtMs: claims.exp * 1000,
        machineCredentialId: claims.machineCredentialId ?? null,
        identityBindingId: null,
      },
    }
  }
  if (authentication.reason === "invalid_account_token_version") return { kind: "unavailable" }
  if (authentication.reason === "account_not_found") {
    return { kind: "rejected", reason: "account not found" }
  }
  if (authentication.reason === "account_inactive") {
    return { kind: "rejected", reason: "account is not active" }
  }
  if (authentication.reason === "token_version_mismatch") {
    return { kind: "rejected", reason: "token has been revoked" }
  }

  return { kind: "rejected", reason: "invalid token" }
}

/** Bearerを外部access tokenまたは従来System sessionとしてAccountへ解決する。 */
type Context = Readonly<{ env: Bindings }>
export class ResolveBearerAccountAdapter {
  constructor(private readonly c: Context) {}
  async resolve(input: { token: string; now: Date }): Promise<BearerAccountResolution> {
    const props = { ...input, env: this.c.env }
    const external = await new ResolveExternalAccessTokenAccountAdapter(this.c).resolve(input)
    if (external.kind === "accepted") {
      const accountId = zAccountId.safeParse(external.accountId)
      if (!accountId.success) return { kind: "rejected", reason: "invalid token" }
      const authentication = await new SystemAccessTokenStateAdapter({
        database: props.env.DB,
      }).resolve({
        accountId: accountId.data,
        tokenVersion: external.tokenVersion,
        issuedAtMs: 0,
        sessionFamilyId: null,
        at: props.now,
      })
      if (authentication instanceof Error) return { kind: "unavailable" }
      if (authentication.kind === "rejected") return { kind: "rejected", reason: "invalid token" }

      return {
        kind: "accepted",
        accountId: accountId.data,
        tokenVersion: external.tokenVersion,
        readAuthentication: {
          accountId: accountId.data,
          tokenVersion: external.tokenVersion,
          issuedAtMs: external.issuedAtMs,
          expiresAtMs: external.expiresAtMs,
          machineCredentialId: null,
          identityBindingId: external.identityBindingId,
        },
      }
    }
    if (external.kind === "rejected") return { kind: "rejected", reason: "invalid token" }
    if (external.kind === "unavailable") return { kind: "unavailable" }

    return await resolveSystemSession(props)
  }
}
