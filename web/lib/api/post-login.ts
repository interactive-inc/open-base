import { sessionResponseSchema } from "@/lib/api/session-response-schema"
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

  const session = sessionResponseSchema.safeParse(await response.json().catch(() => null))

  if (!session.success) {
    return new Error("failed to login")
  }

  return session.data
}
