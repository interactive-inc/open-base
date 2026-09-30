import { resolveBaseUrl } from "@/lib/config/resolve-base-url"
import { SettingsFile } from "@/lib/config/settings-file"

export type BaseConfig = {
  base_url: string
  token: string | null
  refresh_token: string | null
}

/**
 * アクティブな接続先（--base-url ?? BASE_API ?? 既定）のトークンを settings.json から導出する。
 * エントリが無ければ token / refresh_token は null。消費側の変更を最小にするための薄いアダプタ。
 */
export async function loadConfig(baseUrlOverride?: string | null): Promise<BaseConfig> {
  const baseUrl = resolveBaseUrl(baseUrlOverride)

  const tokens = await new SettingsFile().tokensFor(baseUrl)

  return { base_url: baseUrl, token: tokens.token, refresh_token: tokens.refresh_token }
}
