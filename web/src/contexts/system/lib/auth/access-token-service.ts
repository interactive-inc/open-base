import {
  ACCESS_TOKEN_TYPE,
  type AccessTokenClaims,
  zAccessTokenClaims,
} from "@system/domain/schemas/auth/access-token-claims.schema"
import { SystemAccessTokenSecretValue } from "@system/domain/values/auth/system-access-token-secret.value"
import { jwtVerify, SignJWT } from "jose"

export type AccessTokenProfile = Readonly<{
  issuer: string
  audience: string
  purpose: AccessTokenClaims["purpose"]
  maxAgeSeconds: number
}>

type Props = Readonly<{
  profile: AccessTokenProfile
}>

/** Accountだけを主体にするSystem access token adapter。 */
export class AccessTokenService {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async create(
    input: Readonly<{
      accountId: string
      tokenVersion: number
      sessionFamilyId?: string
      machineCredentialId?: string
    }>,
    secret: string,
    now: Date,
  ): Promise<string | Error> {
    const configurationError = this.getConfigurationError(secret, now)
    if (configurationError !== null) return configurationError

    const issuedAtMilliseconds = now.getTime()
    const issuedAtSeconds = Math.floor(issuedAtMilliseconds / 1_000)
    const claims = zAccessTokenClaims.safeParse({
      sub: input.accountId,
      ver: input.tokenVersion,
      purpose: this.props.profile.purpose,
      iss: this.props.profile.issuer,
      aud: this.props.profile.audience,
      jti: crypto.randomUUID(),
      iat: issuedAtSeconds,
      issuedAtMs: issuedAtMilliseconds,
      ...(input.sessionFamilyId === undefined ? {} : { sid: input.sessionFamilyId }),
      ...(input.machineCredentialId === undefined
        ? {}
        : { machineCredentialId: input.machineCredentialId }),
      exp: issuedAtSeconds + this.props.profile.maxAgeSeconds,
    })
    if (!claims.success) return new Error("System access token claims are invalid")

    try {
      return await new SignJWT(claims.data)
        .setProtectedHeader({ alg: "HS256", typ: ACCESS_TOKEN_TYPE })
        .sign(new TextEncoder().encode(secret))
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to create System access token")
    }
  }

  async verify(token: string, secret: string, now: Date): Promise<AccessTokenClaims | Error> {
    const configurationError = this.getConfigurationError(secret, now)
    if (configurationError !== null) return configurationError

    try {
      const verified = await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ["HS256"],
        typ: ACCESS_TOKEN_TYPE,
        issuer: this.props.profile.issuer,
        audience: this.props.profile.audience,
        maxTokenAge: this.props.profile.maxAgeSeconds,
        currentDate: now,
      })
      const claims = zAccessTokenClaims.safeParse(verified.payload)
      if (!claims.success) return new Error("System access token claims are invalid")
      if (
        claims.data.purpose !== this.props.profile.purpose ||
        claims.data.exp - claims.data.iat > this.props.profile.maxAgeSeconds ||
        Math.floor(claims.data.issuedAtMs / 1_000) !== claims.data.iat
      ) {
        return new Error("System access token does not match the required profile")
      }

      return claims.data
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to verify System access token")
    }
  }

  private getConfigurationError(secret: string, now: Date): Error | null {
    if (
      this.props.profile.issuer.length === 0 ||
      this.props.profile.audience.length === 0 ||
      !Number.isSafeInteger(this.props.profile.maxAgeSeconds) ||
      this.props.profile.maxAgeSeconds <= 0
    ) {
      return new Error("System access token profile is invalid")
    }
    if (!Number.isSafeInteger(now.getTime()))
      return new Error("System access token time is invalid")

    const accessTokenSecret = SystemAccessTokenSecretValue.create(secret)

    return accessTokenSecret instanceof Error ? accessTokenSecret : null
  }
}
