import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { jwtVerify, type JWTVerifyGetKey } from "jose"
import { z } from "zod"

const claimsSchema = z.object({
  sub: identitySubjectSchema,
  email: z.string().min(1).max(254),
  email_verified: z.boolean(),
  name: z.string().min(1).max(200),
  iat: z.number(),
  /** 利用者が認証した時刻。再認証の新しさはこの値で判定する。 */
  auth_time: z.number().optional(),
  exp: z.number(),
  jti: z.string().min(1),
})

export type SystemIdentityTokenClaims = z.infer<typeof claimsSchema>

type Context = Readonly<{
  /**
   * ログインに使わせないaud。同じ発行者が別の入口向けに発行したtokenを、
   * audの一つにでも含むならSystem Sessionへ交換させない。未設定・空なら何も除かない。
   */
  excludedAudience?: string
}>

/** 外部Identity tokenの署名・issuer・audience・期限・claimsを検証する。 */
export class SystemIdentityTokenVerifier {
  constructor(private readonly c: Context = {}) {}

  async verify(
    input: Readonly<{
      token: string
      verificationKey: JWTVerifyGetKey
      issuer: string
      audience: string
      now: Date
    }>,
  ): Promise<SystemIdentityTokenClaims | Readonly<{ reason: "invalid_token" }>> {
    try {
      const verified = await jwtVerify(input.token, input.verificationKey, {
        algorithms: ["EdDSA"],
        issuer: input.issuer,
        audience: input.audience,
        currentDate: input.now,
      })
      const audiences =
        typeof verified.payload.aud === "string" ? [verified.payload.aud] : verified.payload.aud
      const excludedAudience = this.c.excludedAudience
      if (
        excludedAudience !== undefined &&
        excludedAudience.length > 0 &&
        audiences?.includes(excludedAudience) === true
      ) {
        return { reason: "invalid_token" }
      }
      const claims = claimsSchema.safeParse(verified.payload)

      return claims.success ? claims.data : { reason: "invalid_token" }
    } catch {
      return { reason: "invalid_token" }
    }
  }
}
