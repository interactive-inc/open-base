import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { startDeviceLogin, waitForDeviceLogin } from "@/lib/auth/device-login"
import { resolveBaseUrl } from "@/lib/config/resolve-base-url"
import { SettingsFile } from "@/lib/config/settings-file"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `base login — ブラウザのパスキーで承認してトークンを取得

usage:
  base login [--base-url <url>] [--no-browser]

表示されたURLをブラウザで開き、パスキーでサインインしてコードを承認します。
接続先は --base-url ?? 環境変数 BASE_API ?? 既定。接続先ごとにトークンを保存する。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "base-url": z.string().optional(),
      "no-browser": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const baseUrl = resolveBaseUrl(query["base-url"])

    const authorization = await startDeviceLogin(baseUrl)

    process.stderr.write(
      `ブラウザで次のURLを開き、コード ${authorization.userCode} を確認して承認してください:\n${authorization.verificationUrl}\n`,
    )

    if (query["no-browser"] === undefined) openBrowser(authorization.verificationUrl)

    const token = await waitForDeviceLogin(baseUrl, authorization)

    const profile = await fetchProfile(baseUrl, token)

    await new SettingsFile().saveLogin(baseUrl, { token }, profile.email, profile.name)

    return c.text(`ログイン成功 base_url=${baseUrl}`)
  },
)

/** 承認を待つ間にブラウザを開く。開けなくてもURLは表示済みなので失敗にしない。 */
function openBrowser(url: string): void {
  const command =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url]
  try {
    Bun.spawn(command, { stdout: "ignore", stderr: "ignore" }).unref()
  } catch {
    // URLは表示済み。
  }
}

/**
 * ログイン直後のトークンで本人の名前とメールアドレスを取得する。失敗しても空文字でログインは通す。
 */
async function fetchProfile(
  baseUrl: string,
  accessToken: string,
): Promise<{ name: string; email: string }> {
  try {
    const client = await createClient(baseUrl)

    const response = await client.company["current-profile"].$get(
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )

    const me = z
      .object({ name: z.string(), email: z.string().nullable().optional() })
      .parse(await response.json())

    return { name: me.name, email: me.email ?? "" }
  } catch {
    return { name: "", email: "" }
  }
}
