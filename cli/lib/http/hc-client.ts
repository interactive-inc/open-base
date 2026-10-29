import type { AppType } from "api/app"
import { hc } from "hono/client"
import { resolveBaseUrl } from "@/lib/config/resolve-base-url"
import { SettingsFile } from "@/lib/config/settings-file"
import { toApiError } from "@/lib/http/to-api-error"

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
 * 更新後のtokenをclient内で維持し、再試行は要求ごとに一回に制限する。
 */
function toFetchOrThrow(baseUrl: string, initialToken: string | null): typeof fetch {
  const authentication = { token: initialToken }

  const handleFetch = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const headers = new Headers(init?.headers)

    if (
      headers.get("Authorization") === (initialToken === null ? null : `Bearer ${initialToken}`)
    ) {
      if (authentication.token !== null)
        headers.set("Authorization", `Bearer ${authentication.token}`)
    }

    const outgoing = { ...init, headers }
    const responses = { current: await fetch(input, outgoing) }

    if (responses.current.ok) {
      return responses.current
    }

    if (responses.current.status === 401) {
      const tokens = await new SettingsFile().tokensFor(baseUrl)

      if (tokens.refresh_token !== null) {
        const refreshed = await tryRefresh(baseUrl, tokens.refresh_token)

        if (refreshed !== null) {
          await new SettingsFile().saveTokens(baseUrl, {
            token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
          })
          authentication.token = refreshed.access_token
          headers.set("Authorization", `Bearer ${refreshed.access_token}`)
          responses.current = await fetch(input, outgoing)
        }
      }
    }

    if (responses.current.ok) return responses.current

    throw toApiError(responses.current.status, await responses.current.text())
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

  return hc<AppType>(baseUrl, { headers, fetch: toFetchOrThrow(baseUrl, tokens.token) })
}

export type Client = Awaited<ReturnType<typeof createClient>>
