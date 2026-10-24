/** CLIがデバイス認証で名乗るclient ID。MCPはCLIのログインを共有する。 */
export const BASE_CLI_CLIENT_ID = "base-cli"

export type AuthSessionMethod = "passkey" | "device"

/**
 * Better Authがセッションを作ったendpointから認証方式を決める。
 * パスキーの認証・登録とデバイス認証のtoken交換だけを受け付け、それ以外のセッション作成は拒否する。
 */
export function readAuthSessionMethod(path: string | undefined): AuthSessionMethod | null {
  if (path === "/passkey/verify-authentication" || path === "/passkey/verify-registration") {
    return "passkey"
  }
  if (path === "/device/token") return "device"
  return null
}

/** デバイスの承認など、直前の本人確認が必要な操作で受け付けるサインインの新しさ。 */
export const FRESH_PASSKEY_MILLISECONDS = 5 * 60 * 1_000

/** セッションが直前にパスキーで作られたものかを判定する。 */
export function isFreshPasskeySession(
  session: Readonly<{ createdAt: Date; authenticationMethod?: unknown }>,
  now: Date,
): boolean {
  const createdAt = new Date(session.createdAt).getTime()
  return (
    session.authenticationMethod === "passkey" &&
    Number.isSafeInteger(createdAt) &&
    createdAt <= now.getTime() &&
    now.getTime() - createdAt <= FRESH_PASSKEY_MILLISECONDS
  )
}
