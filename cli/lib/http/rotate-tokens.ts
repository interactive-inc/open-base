import { z } from "zod"
import type { EndpointTokens } from "@/lib/config/settings-file"

const rotatedSessionSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).nullable(),
})

/** tokenのshapeを検証し、HTTP失敗と通信失敗は認証更新の失敗として返す。 */
export async function rotateTokens(
  baseUrl: string,
  refreshToken: string,
): Promise<EndpointTokens | null> {
  try {
    const response = await fetch(new URL("/system/sessions", baseUrl), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    })
    if (!response.ok) return null

    const session = rotatedSessionSchema.safeParse(await response.json())
    if (!session.success) return null

    return { token: session.data.access_token, refresh_token: session.data.refresh_token }
  } catch {
    return null
  }
}
