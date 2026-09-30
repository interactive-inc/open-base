import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import {
  OidcInvalidGrantApplicationError,
  OidcTemporarilyUnavailableApplicationError,
} from "@system/application/errors"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { OidcClientRegistryValue } from "@system/domain/values/oauth/oidc-client-registry.value"
import { OidcScopeValue } from "@system/domain/values/oauth/oidc-scope.value"
import { oidcAccessTokenLifetime } from "@system/domain/values/oauth/oidc-token-lifetime.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import type {
  SystemClockContext,
  SystemD1Context,
  SystemDatabaseContext,
  SystemOidcSigningContext,
} from "@system/configuration/system-context"
import { CreateOidcAccessTokenAdapter } from "@system/infrastructure/adapters/identity/create-oidc-access-token.adapter"
import { ConsumeOidcAuthorizationCodeAdapter } from "@system/infrastructure/adapters/identity/consume-oidc-authorization-code.adapter"
import { OidcIdTokenService } from "@system/application/auth/identity/lib/oidc-id-token-service"
import { parseOidcSigningKeys } from "@system/application/auth/identity/lib/parse-oidc-signing-keys"
import { SystemOidcIdentityAdapter } from "@system/infrastructure/adapters/identity/system-oidc-identity.adapter"

type Props = Readonly<{
  issuer: string
  code: string
  clientId: string
  redirectUri: string
  codeVerifier: string
  clientRegistry: OidcClientRegistryValue
}>
type Context = SystemDatabaseContext &
  SystemD1Context &
  SystemClockContext &
  SystemOidcSigningContext

/** OIDC codeの検証・消費からtoken発行・監査までを一つの操作として実行する。 */
export class ExchangeOidcAuthorizationCode {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: Props) {
    const client = props.clientRegistry.resolve(props)
    if (client === null) return new OidcInvalidGrantApplicationError()

    const signingKeys = parseOidcSigningKeys(this.c.env.OIDC_SIGNING_KEYS)
    if (signingKeys instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(signingKeys)
    }

    const authorizationCode = await new ConsumeOidcAuthorizationCodeAdapter(
      this.c,
    ).consumeOidcAuthorizationCode({
      issuer: props.issuer,
      clientId: client.id,
      redirectUri: props.redirectUri,
      code: props.code,
      verifier: props.codeVerifier,
    })
    if (authorizationCode instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(authorizationCode)
    }
    if (authorizationCode === null) return new OidcInvalidGrantApplicationError()

    const scope = OidcScopeValue.create(authorizationCode.scope)
    if (scope instanceof Error) return new OidcInvalidGrantApplicationError(scope)

    const identity = await new SystemOidcIdentityAdapter(this.c).findByAccountId(
      authorizationCode.accountId,
    )
    if (identity instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(identity)
    }
    if (identity === null) return new OidcInvalidGrantApplicationError()

    const idToken = await new OidcIdTokenService(this.c).create({
      keys: signingKeys,
      issuer: props.issuer,
      clientId: client.id,
      identity,
      nonce: authorizationCode.nonce,
      scope: scope.items,
    })
    if (idToken instanceof Error) return new OidcTemporarilyUnavailableApplicationError(idToken)

    const accessToken = await new CreateOidcAccessTokenAdapter(this.c).createOidcAccessToken({
      issuer: props.issuer,
      clientId: client.id,
      accountId: authorizationCode.accountId,
      scope: scope.toString(),
    })
    if (accessToken instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(accessToken)
    }

    const audit = SystemAuditEventEntity.createOidc({
      accountId: authorizationCode.accountId,
      action: SYSTEM_AUDIT_ACTIONS.authOidcTokenExchange,
      outcome: "succeeded",
      reasonCode: null,
      authorization: null,
      metadata: { issuer: props.issuer, clientId: client.id, scope: scope.toString() },
      occurredAt: this.c.var.now(),
    })
    if (audit instanceof Error) return new OidcTemporarilyUnavailableApplicationError(audit)

    const appended = await new SystemAuditEventRepository(this.c).append(audit)
    if (appended instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(appended)
    }

    return {
      access_token: accessToken.accessToken,
      token_type: "Bearer" as const,
      expires_in: oidcAccessTokenLifetime.seconds,
      id_token: idToken,
      scope: scope.toString(),
    }
  }
}
