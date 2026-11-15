import { ApiError } from "@/lib/errors"
import { loadConfig } from "@/lib/config/load-config"
import { apiUrl } from "@/lib/http/api-url"

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  query?: Record<string, string | number | boolean | null | undefined>
  json?: unknown
  stepUpToken?: string
  idempotencyKey?: string
  /** Companyの会社やexpected revisionなど、経路ごとに必須の追加ヘッダー。 */
  headers?: Readonly<Record<string, string>>
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options)

  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    return (await response.json()) as T
  }

  return (await response.text()) as T
}

/** 添付や保全原文のように、本文をそのまま保存する応答を読む。 */
export async function apiBytes(path: string, options: RequestOptions = {}): Promise<Uint8Array> {
  const response = await send(path, options)

  return new Uint8Array(await response.arrayBuffer())
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const config = await loadConfig()

  const url = apiUrl(path, config.base_url)

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = { ...options.headers }

  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`
  }

  if (options.stepUpToken !== undefined) {
    headers["x-system-step-up"] = options.stepUpToken
  }
  if (options.idempotencyKey !== undefined) headers["Idempotency-Key"] = options.idempotencyKey

  if (options.json !== undefined) {
    headers["content-type"] = "application/json"
  }

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    signal: AbortSignal.timeout(15_000),
  })

  if (res.ok === false) {
    let message: string

    try {
      message = JSON.stringify(await res.json())
    } catch {
      message = await res.text()
    }

    throw new ApiError(res.status, `ERR ${res.status} ${message}`)
  }

  return res
}
