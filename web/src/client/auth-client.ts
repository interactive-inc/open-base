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

/** 画面から使うBetter Authのclient。サインインは配備で選んだ方式を使い、CLIの承認はデバイス認証を使う。 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [passkeyClient(), deviceAuthorizationClient()],
})

/** Better Authのclientが返す失敗を、画面に出す短い文にする。 */
export function describeAuthError(error: { message?: string; status?: number } | null): string {
  if (error === null) return ""
  if (error.status === 429) return "試行が多すぎます。しばらく待ってからやり直してください。"
  if (error.status === 401) return "認証情報を確認して、もう一度サインインしてください。"
  if (error.status === 403) return "この操作には、もう一度サインインする必要があります。"
  return "処理できませんでした。もう一度やり直してください。"
}
