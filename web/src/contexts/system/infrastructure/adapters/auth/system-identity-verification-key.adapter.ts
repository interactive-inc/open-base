import { SystemIdentityIssuerValue } from "@system/domain/values/identity/system-identity-issuer.value"
import { createLocalJWKSet, createRemoteJWKSet, type JWTVerifyGetKey } from "jose"
import { z } from "zod"

const jwksSchema = z.object({
  keys: z
    .array(
      z
        .object({
          kty: z.literal("OKP"),
          crv: z.literal("Ed25519"),
          x: z.string().min(1),
          kid: z.string().min(1),
          alg: z.literal("EdDSA").optional(),
          use: z.literal("sig").optional(),
        })
        .strict(),
    )
    .min(1),
})

const remoteKeys = new Map<string, JWTVerifyGetKey>()
type SystemIdentityVerificationKeyAdapterContext = Readonly<{
  jwks?: string
  issuer: string
}>
type Context = SystemIdentityVerificationKeyAdapterContext

/** local JWKSまたは検証済みissuerのremote JWKSを解決する。 */
export class SystemIdentityVerificationKeyAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  resolve(): JWTVerifyGetKey | Error {
    if (this.c.jwks !== undefined) {
      try {
        const parsed = jwksSchema.safeParse(JSON.parse(this.c.jwks))

        return parsed.success
          ? createLocalJWKSet(parsed.data)
          : new Error("identity JWKS is invalid")
      } catch {
        return new Error("identity JWKS is invalid")
      }
    }

    try {
      const issuer = new URL(this.c.issuer)
      if (
        !new SystemIdentityIssuerValue(issuer).isSecure ||
        issuer.username !== "" ||
        issuer.password !== "" ||
        issuer.pathname !== "/" ||
        issuer.search !== "" ||
        issuer.hash !== ""
      ) {
        return new Error("identity issuer must be an origin")
      }

      const url = new URL("/.well-known/jwks.json", issuer.origin)
      const cached = remoteKeys.get(url.href)
      if (cached !== undefined) return cached

      const key = createRemoteJWKSet(url, {
        timeoutDuration: 5_000,
        cooldownDuration: 30_000,
        cacheMaxAge: 5 * 60 * 1_000,
      })
      remoteKeys.set(url.href, key)

      return key
    } catch {
      return new Error("identity JWKS URL is invalid")
    }
  }
}
