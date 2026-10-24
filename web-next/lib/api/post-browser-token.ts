import { z } from "zod"
import { createClient } from "@/lib/api/hc-client"

const browserTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().nullable().optional(),
})

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

  const parsed = browserTokenResponseSchema.safeParse(await response.json())

  if (parsed.success === false) {
    return new Error("failed to login")
  }

  return {
    access_token: parsed.data.access_token,
    refresh_token: parsed.data.refresh_token ?? null,
  }
}
