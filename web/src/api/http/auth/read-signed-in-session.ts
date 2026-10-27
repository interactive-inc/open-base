import type { SignInMethod } from "./sign-in-method"
import type { SystemSignedInSession } from "@system/interface/request-environment/system-signed-in-session-channel"
import { readSessionAuthenticatedAt } from "@/api/http/auth/auth-session-method"

type BetterAuthState = Readonly<{
  session: Readonly<{
    id: string
    userId: string
    createdAt: Date
    expiresAt: Date
    accountTokenVersion?: unknown
    authenticationMethod?: unknown
    authenticatedAt?: unknown
  }>
}>

/**
 * Better Authが検証したセッションを、Systemへ渡す形へ変える。
 * 作成時に記録した認証方式とtoken版が無いセッションは、認証に使わない。
 */
export function readSignedInSession(
  state: BetterAuthState | null,
  selectedMethod?: SignInMethod | null,
): SystemSignedInSession | null {
  if (state === null) return null
  const session = state.session
  const method = session.authenticationMethod
  if (
    selectedMethod === null ||
    (selectedMethod !== undefined && method !== "device" && method !== selectedMethod)
  )
    return null
  const tokenVersion = session.accountTokenVersion
  if (method !== "password" && method !== "passkey" && method !== "oidc" && method !== "device")
    return null
  if (typeof tokenVersion !== "number" || !Number.isSafeInteger(tokenVersion) || tokenVersion < 0) {
    return null
  }
  const authenticatedAt = readSessionAuthenticatedAt(session)
  const expiresAt = new Date(session.expiresAt)
  const createdAt = new Date(session.createdAt)
  if (
    (authenticatedAt !== null && !Number.isSafeInteger(authenticatedAt.getTime())) ||
    !Number.isSafeInteger(createdAt.getTime()) ||
    !Number.isSafeInteger(expiresAt.getTime())
  ) {
    return null
  }
  return Object.freeze({
    accountId: session.userId,
    sessionId: session.id,
    authenticatedAt,
    createdAt,
    expiresAt,
    method,
    accountTokenVersion: tokenVersion,
  })
}
