import type { SystemSignedInSession } from "@system/interface/request-environment/system-signed-in-session-channel"

type BetterAuthState = Readonly<{
  session: Readonly<{
    id: string
    userId: string
    createdAt: Date
    expiresAt: Date
    accountTokenVersion?: unknown
    authenticationMethod?: unknown
  }>
}>

/**
 * Better Authが検証したセッションを、Systemへ渡す形へ変える。
 * 作成時に記録した認証方式とtoken版が無いセッションは、認証に使わない。
 */
export function readSignedInSession(state: BetterAuthState | null): SystemSignedInSession | null {
  if (state === null) return null
  const session = state.session
  const method = session.authenticationMethod
  const tokenVersion = session.accountTokenVersion
  if (method !== "passkey" && method !== "device") return null
  if (typeof tokenVersion !== "number" || !Number.isSafeInteger(tokenVersion) || tokenVersion < 0) {
    return null
  }
  const authenticatedAt = new Date(session.createdAt)
  const expiresAt = new Date(session.expiresAt)
  if (
    !Number.isSafeInteger(authenticatedAt.getTime()) ||
    !Number.isSafeInteger(expiresAt.getTime())
  ) {
    return null
  }
  return Object.freeze({
    accountId: session.userId,
    sessionId: session.id,
    authenticatedAt,
    expiresAt,
    method,
    accountTokenVersion: tokenVersion,
  })
}
