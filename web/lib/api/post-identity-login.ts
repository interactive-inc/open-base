import { sessionResponseSchema } from "@/lib/api/session-response-schema"
import { createClient } from "@/lib/api/hc-client"

/**
 * POST /system/identity-sessions。外部 identity provider が発行した短命トークンを
 * サーバーサイドで交換し、アクセストークンを取得する。未認証フローで呼ばれる。
 * 拒否理由はアカウントの存在を外部へ漏らさないSystem APIの一律401へ従う。
 */
export async function postIdentityLogin(body: { token: string }) {
  const client = await createClient()

  const response = await client.system["identity-sessions"].$post({ json: body })

  if (response.status >= 400) {
    return new Error("failed to login")
  }

  const parsed = sessionResponseSchema.safeParse(await response.json().catch(() => null))

  if (parsed.success === false) {
    return new Error("failed to login")
  }

  return parsed.data
}
