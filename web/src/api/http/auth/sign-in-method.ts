/** 人のサインインに使う方式。配備ごとに `SIGN_IN_METHOD` でいずれか一つを選ぶ。 */
export type SignInMethod = "password" | "passkey" | "oidc"

/**
 * `SIGN_IN_METHOD` を読む。未設定なら passkey にする。
 * 知らない値は設定の誤りとして null を返し、サインインを受け付けない。
 */
export function readSignInMethod(env: Readonly<Record<string, unknown>>): SignInMethod | null {
  const value = env.SIGN_IN_METHOD
  if (value === undefined || value === "") return "passkey"
  return value === "password" || value === "passkey" || value === "oidc" ? value : null
}

export type OidcConfiguration = Readonly<{
  issuer: string
  clientId: string
  /** public clientなら null。PKCEは常に使う。 */
  clientSecret: string | null
  /** API用やService Binding用のaud。これを含むID tokenはサインインに使わない。 */
  excludedAudiences: ReadonlyArray<string>
}>

/**
 * OIDCのサインインに使う設定を読む。発行者はHTTPS（開発用のloopbackだけHTTPも可）に限り、
 * 足りなければ null を返す。
 * 発行者は外部access tokenと同じ `IDENTITY_ISSUER` を使う。
 */
export function readOidcConfiguration(
  env: Readonly<Record<string, unknown>>,
): OidcConfiguration | null {
  const issuer = text(env.IDENTITY_ISSUER)
  const clientId = text(env.OIDC_CLIENT_ID)
  if (issuer === null || clientId === null) return null
  let url: URL
  try {
    url = new URL(issuer)
  } catch {
    return null
  }
  if (!isSecureOidcUrl(url) || url.search !== "" || url.hash !== "") return null
  const excludedAudiences = [
    text(env.IDENTITY_ACCESS_TOKEN_AUDIENCE),
    text(env.SERVICE_BINDING_ACCESS_TOKEN_AUDIENCE),
  ].filter((audience): audience is string => audience !== null)
  // client IDがAPI用のaudと同じなら、ID tokenとaccess tokenを取り違えるので使わない。
  if (excludedAudiences.includes(clientId)) return null
  return Object.freeze({
    issuer,
    clientId,
    clientSecret: text(env.OIDC_CLIENT_SECRET),
    excludedAudiences: Object.freeze(excludedAudiences),
  })
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null
}

/** HTTPSか、手元で動かす開発用IdPのloopbackだけを受け付ける。 */
export function isSecureOidcUrl(url: URL): boolean {
  if (url.protocol === "https:") return true
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")
}
