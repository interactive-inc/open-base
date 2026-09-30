import { SignJWT } from "jose"

type SigningKey = Parameters<SignJWT["sign"]>[0]

export type SystemIdentityTokenOverrides = {
  sub?: string
  email?: string
  emailVerified?: boolean
  name?: string
  jti?: string
  issuer?: string
  audience?: string
  iat?: number
  /** 利用者が認証した時刻。null なら claim を載せない。 */
  authTime?: number | null
  exp?: number
  alg?: string
  keyId?: string
}

/** 外部Identity Providerの短命なテスト用ログイントークンを作る。 */
export function createSystemIdentityToken(
  signingKey: SigningKey,
  nowEpoch: number,
  overrides: SystemIdentityTokenOverrides = {},
): Promise<string> {
  const claims = {
    sub: overrides.sub ?? "external-subject-1",
    email: overrides.email ?? "you+ext@example.com",
    email_verified: overrides.emailVerified ?? true,
    name: overrides.name ?? "External Worker",
    jti: overrides.jti ?? "token-jti-1",
    ...(overrides.authTime === null ? {} : { auth_time: overrides.authTime ?? nowEpoch }),
  }

  return new SignJWT(claims)
    .setProtectedHeader({
      alg: overrides.alg ?? "EdDSA",
      kid: overrides.keyId ?? "identity-test-key",
    })
    .setIssuer(overrides.issuer ?? "https://identity-provider.example/")
    .setAudience(overrides.audience ?? "urn:system:identity-test")
    .setIssuedAt(overrides.iat ?? nowEpoch)
    .setExpirationTime(overrides.exp ?? nowEpoch + 60)
    .sign(signingKey)
}
