import { readResponseErrorBody } from "@base/http/read-response-error-body"
import { ApiError } from "@/lib/errors"
import { loadConfig } from "@/lib/config/load-config"
import { SettingsFile } from "@/lib/config/settings-file"
import { toApiError } from "@/lib/http/to-api-error"
import { rotateTokens } from "@/lib/http/rotate-tokens"

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  query?: Record<string, string | number | boolean | null | undefined>
  json?: unknown
  stepUpToken?: string
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const config = await loadConfig()

  try {
    return await request<T>(config.base_url, config.token, path, options)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && config.refresh_token !== null) {
      const refreshed = await new SettingsFile().refreshTokens(
        config.base_url,
        config.token,
        (refreshToken) => rotateTokens(config.base_url, refreshToken),
      )

      if (refreshed !== null) {
        return await request<T>(config.base_url, refreshed.token, path, options)
      }
    }

    throw error
  }
}

async function request<T = unknown>(
  baseUrl: string,
  token: string | null,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = new URL(path, baseUrl)

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = {}

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (options.stepUpToken !== undefined) {
    headers["x-system-step-up"] = options.stepUpToken
  }

  if (options.json !== undefined) {
    headers["content-type"] = "application/json"
  }

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  })

  if (res.ok === false) {
    const body = await readResponseErrorBody(res)

    throw toApiError(res.status, body)
  }

  const contentType = res.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    return (await res.json()) as T
  }

  return (await res.text()) as T
}
