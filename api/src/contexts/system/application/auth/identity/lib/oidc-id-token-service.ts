import { oidcSigningAlgorithm } from "@system/domain/values/oauth/oidc-signing-algorithm.value"
import { oidcAccessTokenLifetime } from "@system/domain/values/oauth/oidc-token-lifetime.value"
import { createOidcSecret } from "@system/application/auth/identity/lib/create-oidc-secret"
import type { OidcSigningKeysValue } from "@system/domain/definitions/oauth/oidc-signing-keys.definition"
import type { SystemClockContext } from "@system/configuration/system-context"
import { importJWK, SignJWT } from "jose"

export type OidcIdentity = Readonly<{
  subject: string
  email: string | null
  emailVerified: boolean
}>

type Props = Readonly<{
  keys: OidcSigningKeysValue
  issuer: string
  clientId: string
  identity: OidcIdentity
  nonce: string
  scope: ReadonlyArray<string>
}>

export class OidcIdTokenService {
  constructor(private readonly c: SystemClockContext) {}

  async create(props: Props): Promise<string | Error> {
    try {
      const signingKey = await importJWK(props.keys.active, oidcSigningAlgorithm.toString())
      const nowSeconds = Math.floor(this.c.var.now().getTime() / 1000)
      const payload: Record<string, unknown> = { nonce: props.nonce }

      if (props.scope.includes("email") && props.identity.email !== null) {
        payload.email = props.identity.email
        payload.email_verified = props.identity.emailVerified
      }

      return await new SignJWT(payload)
        .setProtectedHeader({
          alg: oidcSigningAlgorithm.toString(),
          kid: props.keys.active.kid,
          typ: "JWT",
        })
        .setIssuer(props.issuer)
        .setSubject(props.identity.subject)
        .setAudience(props.clientId)
        .setIssuedAt(nowSeconds)
        .setExpirationTime(nowSeconds + oidcAccessTokenLifetime.seconds)
        .setJti(createOidcSecret())
        .sign(signingKey)
    } catch {
      return new Error("id_token_signing_failed")
    }
  }
}
