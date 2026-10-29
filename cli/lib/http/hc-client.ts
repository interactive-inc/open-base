import { readResponseErrorBody } from "@base/http/read-response-error-body"
import type { AppType } from "api/app"
import { hc } from "hono/client"
import { resolveBaseUrl } from "@/lib/config/resolve-base-url"
import { SettingsFile } from "@/lib/config/settings-file"
import { toApiError } from "@/lib/http/to-api-error"
import { rotateTokens } from "@/lib/http/rotate-tokens"

/**
 * 解決済み baseUrl を閉じ込めた fetch ラッパーを作る。401 時の refresh は必ずこの baseUrl の
 * エントリを読み書きするため、--base-url 指定時に別エンドポイントのトークンを触らない。
 * 更新後のtokenをclient内で維持し、再試行は要求ごとに一回に制限する。
 */
function toFetchOrThrow(
  baseUrl: string,
  initialToken: string | null,
  canRefreshSession = true,
): typeof fetch {
  const authentication = { token: initialToken }

  const handleFetch = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const headers = new Headers(init?.headers)
    const usesStoredAuthentication =
      headers.get("Authorization") === (initialToken === null ? null : `Bearer ${initialToken}`)

    if (usesStoredAuthentication) {
      if (authentication.token !== null)
        headers.set("Authorization", `Bearer ${authentication.token}`)
    }

    const firstAttempt = new AbortController()
    const callerSignal = init?.signal ?? null
    const outgoing: RequestInit = {
      ...init,
      redirect: "error",
      headers,
      signal:
        callerSignal === null
          ? firstAttempt.signal
          : AbortSignal.any([callerSignal, firstAttempt.signal]),
    }
    const responses = { current: await fetch(input, outgoing) }

    if (responses.current.ok) {
      return responses.current
    }

    if (responses.current.status === 401 && usesStoredAuthentication && canRefreshSession) {
      const refreshed = await new SettingsFile()
        .refreshTokens(
          baseUrl,
          headers.get("Authorization")?.replace(/^Bearer /, "") ?? null,
          (refreshToken) => rotateTokens(baseUrl, refreshToken),
        )
        .catch((error: unknown) => {
          firstAttempt.abort()
          void responses.current.body?.cancel().catch(() => undefined)
          throw error
        })

      if (refreshed !== null && refreshed.token !== null) {
        // Bunの通信も解放する。cleanupの失敗や停止で再送を止めない。
        firstAttempt.abort()
        void responses.current.body?.cancel().catch(() => undefined)
        authentication.token = refreshed.token
        headers.set("Authorization", `Bearer ${refreshed.token}`)
        responses.current = await fetch(input, { ...init, redirect: "error", headers })
      }
    }

    if (responses.current.ok) return responses.current

    throw toApiError(
      responses.current.status,
      await readResponseErrorBody(responses.current, callerSignal),
    )
  }

  return Object.assign(handleFetch, { preconnect: fetch.preconnect })
}

export async function createClient(
  baseUrlOverride?: string | null,
  options: Readonly<{ authentication?: "stored-session" | "none" }> = {},
) {
  const baseUrl = resolveBaseUrl(baseUrlOverride)

  // 資格情報によるsession作成は、既存のsessionを読まず、401でもrotationしない。
  if (options.authentication === "none")
    return hc<AppType>(baseUrl, { fetch: toFetchOrThrow(baseUrl, null, false) })

  const tokens = await new SettingsFile().tokensFor(baseUrl)

  const headers: Record<string, string> = {}

  if (tokens.token !== null) {
    headers.Authorization = `Bearer ${tokens.token}`
  }

  return hc<AppType>(baseUrl, { headers, fetch: toFetchOrThrow(baseUrl, tokens.token) })
}

export type Client = Awaited<ReturnType<typeof createClient>>
