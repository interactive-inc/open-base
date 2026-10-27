import type { SignInMethod } from "./sign-in-method.ts"

const sessionPaths = new Set([
  "/get-session",
  "/sign-out",
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
  "/ok",
  "/error",
])
const devicePaths = new Set([
  "/device",
  "/device/code",
  "/device/token",
  "/device/approve",
  "/device/deny",
])
const passkeyPaths = new Set([
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  "/passkey/generate-authenticate-options",
  "/passkey/verify-authentication",
  "/passkey/list-user-passkeys",
  "/passkey/delete-passkey",
  "/passkey/update-passkey",
])

/** 選んだ方式とセッション管理だけを公開する。資格情報の変更と自己登録はSystemが所有する。 */
export function isEnabledAuthPath(path: string, method: SignInMethod | null): boolean {
  if (sessionPaths.has(path)) return true
  if (method === null) return false
  if (devicePaths.has(path)) return true
  if (path === "/sign-in/email") return method === "password"
  if (path === "/oidc/sign-in" || path === "/oidc/callback") return method === "oidc"
  return method === "passkey" && passkeyPaths.has(path)
}

/** 資格の追加・委任には、セッション発行後の停止と失効も反映する。 */
export function requiresCurrentSession(path: string): boolean {
  return (
    path === "/device" ||
    path === "/device/approve" ||
    path === "/device/deny" ||
    (passkeyPaths.has(path) &&
      path !== "/passkey/generate-authenticate-options" &&
      path !== "/passkey/verify-authentication") ||
    path === "/list-sessions" ||
    path.startsWith("/revoke-")
  )
}
