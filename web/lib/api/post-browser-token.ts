import { sessionResponseSchema } from "@/lib/api/session-response-schema"
import { createClient } from "@/lib/api/hc-client"

/**
 * POST /system/browser-sessions。認証済みの CLI が発行した one-time code を
 * サーバーサイドで交換し、アクセストークンを取得する。未認証フローで呼ばれる。
 */
export async function postBrowserToken(body: { code: string }) {
  const client = await createClient()

  const response = await client.system["browser-sessions"].$post({ json: body })

  if (response.status >= 400) {
    return new Error("failed to login")
  }

  const parsed = sessionResponseSchema.safeParse(await response.json().catch(() => null))

  if (parsed.success === false) {
    return new Error("failed to login")
  }

  return parsed.data
}
