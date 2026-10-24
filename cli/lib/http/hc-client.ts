import type { AppType } from "web/app"
import { hc } from "hono/client"
import { resolveBaseUrl } from "@/lib/config/resolve-base-url"
import { SettingsFile } from "@/lib/config/settings-file"
import { ApiError } from "@/lib/errors"
import { apiBaseUrl } from "@/lib/http/api-url"

/**
 * 失敗した応答を ApiError にする fetch ラッパーを作る。
 * セッションの延長はサーバーが行うので、401 では再試行せずログインし直してもらう。
 */
function toFetchOrThrow(): typeof fetch {
  const handleFetch = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const response = await fetch(input, init)

    if (response.ok) {
      return response
    }

    const raw = await response.text()

    let detail: string

    try {
      detail = JSON.stringify(JSON.parse(raw))
    } catch {
      detail = raw
    }

    throw new ApiError(
      response.status,
      detail === "" ? `ERR ${response.status}` : `ERR ${response.status} ${detail}`,
    )
  }

  return Object.assign(handleFetch, { preconnect: fetch.preconnect })
}

export async function createClient(baseUrlOverride?: string | null) {
  const baseUrl = resolveBaseUrl(baseUrlOverride)

  const tokens = await new SettingsFile().tokensFor(baseUrl)

  const headers: Record<string, string> = {}

  if (tokens.token !== null) {
    headers.Authorization = `Bearer ${tokens.token}`
  }

  return hc<AppType>(apiBaseUrl(baseUrl), { headers, fetch: toFetchOrThrow() })
}

export type Client = Awaited<ReturnType<typeof createClient>>
