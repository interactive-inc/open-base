import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { resolveBaseUrl } from "@/lib/config/resolve-base-url"
import { SettingsFile } from "@/lib/config/settings-file"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base login — ログインしてトークンを取得

usage:
  base login --email <email> --password <password> [--base-url <url>]

接続先は --base-url ?? 環境変数 BASE_API ?? 既定。接続先ごとにトークンを保存する。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      email: z.string().optional(),
      password: z.string().optional(),
      "base-url": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.email || !query.password) {
      throw new UsageError("--email と --password が必要です")
    }

    const baseUrl = resolveBaseUrl(query["base-url"])

    const client = await createClient(baseUrl)

    // createClient の fetch ラッパーが 4xx/5xx を ApiError として throw するため、
    // ここに来た時点で response は必ず成功。手動の ok チェックは不要。
    const response = await client.system.sessions.$post({
      json: { subject: query.email, password: query.password },
    })

    const result = z
      .object({
        access_token: z.string(),
        refresh_token: z.string().nullable(),
      })
      .parse(await response.json())

    const name = await fetchName(baseUrl, result.access_token)

    await new SettingsFile().saveLogin(
      baseUrl,
      { token: result.access_token, refresh_token: result.refresh_token },
      query.email,
      name,
    )

    return c.text(`ログイン成功 base_url=${baseUrl}`)
  },
)

/**
 * ログイン直後の access_token で /me を叩き name を取得する。失敗しても "" を返しログインは通す。
 */
async function fetchName(baseUrl: string, accessToken: string): Promise<string> {
  try {
    const client = await createClient(baseUrl)

    const response = await client.company["current-profile"].$get(
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )

    const me = z.object({ name: z.string() }).parse(await response.json())

    return me.name
  } catch {
    return ""
  }
}
