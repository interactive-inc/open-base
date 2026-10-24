import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { apiUrl } from "@/lib/api-url.ts"

type EndpointTokens = {
  token: string | null
}

function resolveBaseUrl(): string {
  const fromEnv = process.env.BASE_API

  if (fromEnv !== undefined && fromEnv !== "") {
    return fromEnv
  }

  // パスキーはIPアドレスのoriginで使えないため、CLIと同じくportlessのホスト名を既定にする。
  return "https://base.localhost"
}

async function readTokens(baseUrl: string): Promise<EndpointTokens> {
  const file = configFile()

  let raw: string

  try {
    raw = await readFile(file, "utf8")
  } catch {
    return { token: null }
  }

  if (raw.trim() === "") {
    return { token: null }
  }

  let value: unknown

  try {
    value = JSON.parse(raw)
  } catch {
    return { token: null }
  }

  if (typeof value !== "object" || value === null) {
    return { token: null }
  }

  const endpoints = (value as Record<string, unknown>).endpoints

  if (typeof endpoints !== "object" || endpoints === null) {
    return { token: null }
  }

  const entry = (endpoints as Record<string, unknown>)[baseUrl]

  if (typeof entry !== "object" || entry === null) {
    return { token: null }
  }

  const e = entry as Record<string, unknown>
  const accessToken =
    typeof e.accessToken === "string" && e.accessToken !== "" ? e.accessToken : null

  return { token: accessToken }
}

function configDir(): string {
  return process.env.BASE_CONFIG_DIR ?? join(homedir(), ".config", "base")
}

function configFile(): string {
  return join(configDir(), "settings.json")
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  query?: Record<string, string | number | boolean | null | undefined>
  idempotencyKey?: string
  json?: unknown
}

let cachedBaseUrl: string | null = null
let cachedToken: string | null = null

export async function ensureAuth(): Promise<{ baseUrl: string; token: string | null }> {
  if (cachedBaseUrl !== null) {
    return { baseUrl: cachedBaseUrl, token: cachedToken }
  }

  cachedBaseUrl = resolveBaseUrl()

  const tokens = await readTokens(cachedBaseUrl)

  cachedToken = tokens.token

  return { baseUrl: cachedBaseUrl, token: cachedToken }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { baseUrl, token } = await ensureAuth()

  const url = apiUrl(path, baseUrl)

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = {}
  if (options.idempotencyKey !== undefined) headers["Idempotency-Key"] = options.idempotencyKey

  if (token !== null) {
    headers.Authorization = `Bearer ${token}`
  }

  if (options.json !== undefined) {
    headers["content-type"] = "application/json"
  }

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    signal: AbortSignal.timeout(15_000),
  })

  // セッションの延長はサーバーが行う。切れたセッションはCLIでログインし直してもらう。
  if (res.status === 401) {
    await res.body?.cancel()
    throw new Error("API 401: セッションが切れています。base login でログインし直してください")
  }

  if (res.ok === false) {
    const contentType = res.headers.get("content-type") ?? ""
    const body = contentType.includes("application/json")
      ? JSON.stringify(await res.json())
      : await res.text()

    throw new Error(`API ${res.status}: ${body}`)
  }

  const contentType = res.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    return (await res.json()) as T
  }

  return (await res.text()) as T
}
