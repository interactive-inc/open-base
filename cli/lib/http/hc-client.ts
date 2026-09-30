import type { AppType } from "api/app"
import { hc } from "hono/client"
import { resolveBaseUrl } from "@/lib/config/resolve-base-url"
import { SettingsFile } from "@/lib/config/settings-file"
import { ApiError } from "@/lib/errors"

async function tryRefresh(
  baseUrl: string,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string | null } | null> {
  try {
    const url = new URL("/system/sessions", baseUrl)

    const res = await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(15_000),
    })

    if (res.ok === false) {
      return null
    }

    return (await res.json()) as { access_token: string; refresh_token: string | null }
  } catch {
    return null
  }
}

/**
 * 解決済み baseUrl を閉じ込めた fetch ラッパーを作る。401 時の refresh は必ずこの baseUrl の
 * エントリを読み書きするため、--base-url 指定時に別エンドポイントのトークンを触らない。
 * refreshAttempted はクライアント毎に持ち、モジュール状態を共有しない。
 */
function toFetchOrThrow(baseUrl: string): typeof fetch {
  let refreshAttempted = false

  const handleFetch = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const response = await fetch(input, init)

    if (response.ok) {
      return response
    }

    if (response.status === 401 && refreshAttempted === false) {
      refreshAttempted = true

      const tokens = await new SettingsFile().tokensFor(baseUrl)

      if (tokens.refresh_token !== null) {
        const refreshed = await tryRefresh(baseUrl, tokens.refresh_token)

        if (refreshed !== null) {
          await new SettingsFile().saveTokens(baseUrl, {
            token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
          })

          const retryInit = init !== undefined ? { ...init } : {}

          const retryHeaders = new Headers(retryInit.headers)

          retryHeaders.set("Authorization", `Bearer ${refreshed.access_token}`)

          retryInit.headers = retryHeaders

          return await fetch(input, retryInit)
        }
      }
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

  return hc<AppType>(baseUrl, { headers, fetch: toFetchOrThrow(baseUrl) })
}

export type Client = Awaited<ReturnType<typeof createClient>>
