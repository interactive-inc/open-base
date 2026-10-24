import { createClient } from "@/lib/api/hc-client"
import type { LoginRequest } from "@/lib/api/types/auth-types"

/**
 * POST /system/sessions をメール・パスワードで呼び、アクセストークンを取得する。
 * 未認証フロー（session なし）でも createClient のトークンは null となり動作する。
 */
export async function postLogin(body: LoginRequest) {
  const client = await createClient()

  const response = await client.system.sessions.$post({
    json: { subject: body.email, password: body.password },
  })

  if (response.status >= 400) {
    return new Error("failed to login")
  }

  const loginResult = await response.json()

  if ("access_token" in loginResult === false) {
    return new Error("failed to login")
  }

  return {
    access_token: loginResult.access_token,
    refresh_token: loginResult.refresh_token ?? null,
  }
}
