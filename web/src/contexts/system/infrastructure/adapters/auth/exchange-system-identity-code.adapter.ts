import { z } from "zod"
import { SystemIdentityIssuerValue } from "@system/domain/values/identity/system-identity-issuer.value"

type Props = {
  code: string
  codeVerifier: string
  redirectUri: string
  issuer: string
}

const responseSchema = z.object({
  id_token: z.string().min(1).max(4096),
})

/**
 * ブローカーのone-time codeをPKCE verifierでidentity JWTへ交換する。
 */
export class ExchangeSystemIdentityCodeAdapter {
  async exchangeSystemIdentityCode(props: Props): Promise<string | Error> {
    try {
      const issuer = new URL(props.issuer)
      if (!new SystemIdentityIssuerValue(issuer).isSecure) {
        return new Error("identity issuer must use HTTPS")
      }

      const response = await fetch(new URL("/token", issuer.origin), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: props.code,
          redirect_uri: props.redirectUri,
          code_verifier: props.codeVerifier,
        }),
        signal: AbortSignal.timeout(10_000),
      })
      if (response.ok === false) {
        return new Error("identity code exchange failed")
      }

      const parsed = responseSchema.safeParse(await response.json())
      if (parsed.success === false) {
        return new Error("identity code response is invalid")
      }

      return parsed.data.id_token
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("identity code exchange failed")
    }
  }
}
