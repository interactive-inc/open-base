/** CLIがデバイス認証で名乗るclient ID。MCPはCLIのログインを共有する。 */
export const BASE_CLI_CLIENT_ID = "base-cli"

/** OIDCのサインインを受け取るBetter Authのendpoint。 */
export const OIDC_CALLBACK_PATH = "/oidc/callback"

export type AuthSessionMethod = "password" | "passkey" | "oidc" | "device"

/**
 * Better Authがセッションを作ったendpointから認証方式を決める。
 * パスワード、パスキーの認証・登録、OIDCの戻り先、デバイス認証のtoken交換を受け付け、
 * それ以外のセッション作成は拒否する。
 */
export function readAuthSessionMethod(path: string | undefined): AuthSessionMethod | null {
  if (path === "/passkey/verify-authentication" || path === "/passkey/verify-registration") {
    return "passkey"
  }
  if (path === "/sign-in/email") return "password"
  if (path === OIDC_CALLBACK_PATH) return "oidc"
  if (path === "/device/token") return "device"
  return null
}

/** デバイスの承認や再認証など、直前の本人確認が必要な操作で受け付けるサインインの新しさ。 */
export const FRESH_SIGN_IN_MILLISECONDS = 5 * 60 * 1_000

/**
 * セッションを作った認証の時刻。OIDCではIdPでの認証時刻が記録されていればそれを使い、
 * セッションの作成時刻より新しくは扱わない。
 */
export function readSessionAuthenticatedAt(
  session: Readonly<{ createdAt: Date; authenticatedAt?: unknown; authenticationMethod?: unknown }>,
): Date | null {
  const createdAt = new Date(session.createdAt).getTime()
  const recorded = session.authenticatedAt
  if (
    session.authenticationMethod === "oidc" &&
    (typeof recorded !== "number" || !Number.isSafeInteger(recorded))
  )
    return null
  const authenticatedAt =
    typeof recorded === "number" && Number.isSafeInteger(recorded)
      ? Math.min(recorded, createdAt)
      : createdAt
  return new Date(authenticatedAt)
}

/** セッションが直前に人のサインイン（パスワード・パスキー・OIDC）で作られたものかを判定する。 */
export function isFreshSignInSession(
  session: Readonly<{ createdAt: Date; authenticationMethod?: unknown; authenticatedAt?: unknown }>,
  now: Date,
): boolean {
  const method = session.authenticationMethod
  const authenticatedAt = readSessionAuthenticatedAt(session)?.getTime() ?? Number.NaN
  return (
    (method === "password" || method === "passkey" || method === "oidc") &&
    Number.isSafeInteger(authenticatedAt) &&
    authenticatedAt <= now.getTime() &&
    now.getTime() - authenticatedAt <= FRESH_SIGN_IN_MILLISECONDS
  )
}
