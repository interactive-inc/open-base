import type { AppType } from "api/app"
import { hc } from "hono/client"
import { apiFetch } from "@/lib/api/api-fetch"
import { z } from "zod"

const sessionSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).nullable().default(null),
})

/**
 * PATCH /system/sessions を refresh_token で呼び、新しい access_token を取得する。
 * Middleware（Edge Runtime）から呼ぶため `createClient`（`next/headers` 依存）は使わず、
 * トークン不要のクライアントをその場で作る。
 */
export async function postRefreshToken(refreshToken: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://base.localhost"

  const client = hc<AppType>(baseUrl, { fetch: apiFetch })

  try {
    const response = await client.system.sessions.$patch(
      { json: { refresh_token: refreshToken } },
      { init: { signal: AbortSignal.timeout(10_000) } },
    )

    if (response.status >= 400) return new Error("failed to refresh token")

    const session = sessionSchema.safeParse(await response.json())

    if (session.success) return session.data
  } catch {
    // 更新失敗もmiddlewareのbackoffへ渡し、画面の回復導線を保つ。
    return new Error("failed to refresh token")
  }

  return new Error("failed to refresh token")
}
