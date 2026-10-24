import { passkeyClient } from "@better-auth/passkey/client"
import type { deviceAuthorization } from "better-auth/plugins"
import { createAuthClient } from "void/client"

/**
 * デバイス認証のclient plugin。better-auth/client/plugins と同じ内容を置く。
 * Voidは開発時に better-auth/client を前方一致で置き換えるため、その下の経路を読み込めない。
 */
function deviceAuthorizationClient() {
  return {
    id: "device-authorization" as const,
    $InferServerPlugin: {} as ReturnType<typeof deviceAuthorization>,
    pathMethods: {
      "/device/code": "POST",
      "/device/token": "POST",
      "/device": "GET",
      "/device/approve": "POST",
      "/device/deny": "POST",
    } as const,
  }
}

/** 画面から使うBetter Authのclient。サインインはパスキー、CLIの承認はデバイス認証だけを使う。 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [passkeyClient(), deviceAuthorizationClient()],
})

/** Better Authのclientが返す失敗を、画面に出す短い文にする。 */
export function describeAuthError(error: { message?: string; status?: number } | null): string {
  if (error === null) return ""
  if (error.status === 429) return "試行が多すぎます。しばらく待ってからやり直してください。"
  return error.message ?? "処理できませんでした。もう一度やり直してください。"
}
