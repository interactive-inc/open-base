import { SystemIdentityIssuerValue } from "@system/domain/values/identity/system-identity-issuer.value"
import { SystemIdentityVerificationKeyAdapter } from "@system/infrastructure/adapters/auth/system-identity-verification-key.adapter"
import { createRemoteJWKSet, type JWTVerifyGetKey } from "jose"
import { z } from "zod"

const discoverySchema = z.object({
  issuer: z.string().min(1),
  jwks_uri: z.string().min(1),
})

const remoteKeys = new Map<string, JWTVerifyGetKey>()

function secureOrigin(value: string): URL | Error {
  try {
    const url = new URL(value)

    if (
      !new SystemIdentityIssuerValue(url).isSecure ||
      url.username !== "" ||
      url.password !== "" ||
      url.pathname !== "/" ||
      url.search !== "" ||
      url.hash !== ""
    ) {
      return new Error("external access token issuer must be an HTTPS origin")
    }

    return url
  } catch {
    return new Error("external access token issuer is invalid")
  }
}

async function discoverRemoteKey(issuer: URL): Promise<JWTVerifyGetKey | Error> {
  const cached = remoteKeys.get(issuer.origin)
  if (cached !== undefined) return cached

  try {
    const response = await fetch(new URL("/.well-known/openid-configuration", issuer.origin), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) return new Error("external identity discovery failed")

    const metadata = discoverySchema.safeParse(await response.json())
    if (!metadata.success || metadata.data.issuer !== issuer.origin) {
      return new Error("external identity discovery is invalid")
    }

    const jwksUrl = new URL(metadata.data.jwks_uri)
    if (jwksUrl.protocol !== "https:" || jwksUrl.username !== "" || jwksUrl.password !== "") {
      return new Error("external identity JWKS URL is invalid")
    }

    const key = createRemoteJWKSet(jwksUrl, {
      timeoutDuration: 5_000,
      cooldownDuration: 30_000,
      cacheMaxAge: 5 * 60 * 1_000,
    })
    remoteKeys.set(issuer.origin, key)

    return key
  } catch {
    return new Error("external identity discovery failed")
  }
}

/** 設定済みの外部IdPからaccess token検証鍵を解決する。 */
type Context = Readonly<{ issuer: string; jwks: string | undefined }>
export class ExternalAccessTokenVerificationKeyAdapter {
  constructor(private readonly c: Context) {}
  async resolve(): Promise<JWTVerifyGetKey | Error> {
    const props = this.c
    const issuer = secureOrigin(props.issuer)
    if (issuer instanceof Error) return issuer

    if (props.jwks !== undefined) {
      return new SystemIdentityVerificationKeyAdapter({
        issuer: issuer.origin,
        jwks: props.jwks,
      }).resolve()
    }

    return await discoverRemoteKey(issuer)
  }
}
