import { SignJWT, type JWTPayload } from "jose"

type SigningKey = Parameters<SignJWT["sign"]>[0]

export type SystemExternalAccessTokenOptions = Readonly<{
  signingKey: SigningKey
  keyId: string
  now: Date
  subject: string
  issuer?: string
  audience?: string | ReadonlyArray<string>
  /** 既定のclaimへ重ねる値。undefinedを渡したclaimは載せない。 */
  claims?: Readonly<Record<string, unknown>>
  typ?: string
  expiresInSeconds?: number
}>

/** 外部IdPが発行するEdDSAの `at+jwt` access tokenをテスト用に作る。 */
export async function createSystemExternalAccessToken(
  options: SystemExternalAccessTokenOptions,
): Promise<string> {
  const issuedAt = Math.floor(options.now.getTime() / 1000)
  const merged: Record<string, unknown> = {
    iss: options.issuer ?? "https://identity.example.com",
    aud: options.audience ?? "https://api.example.com",
    sub: options.subject,
    client_id: "test-client",
    scope: "openid",
    jti: crypto.randomUUID(),
    iat: issuedAt,
    exp: issuedAt + (options.expiresInSeconds ?? 300),
    ...options.claims,
  }
  const payload: JWTPayload = Object.fromEntries(
    Object.entries(merged).filter(([, value]) => value !== undefined),
  )

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "EdDSA", typ: options.typ ?? "at+jwt", kid: options.keyId })
    .sign(options.signingKey)
}
