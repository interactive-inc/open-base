import { readResponseErrorBody } from "@base/http/read-response-error-body"
import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { AuthenticationState } from "@/lib/authentication-state"
import { SessionRefreshCoordinator } from "@/lib/session-refresh-coordinator"
import { refreshCurrentToken } from "@/lib/refresh-current-token"
import { AuthFileLock } from "@base/client-auth/auth-file-lock"
import { writePrivateJson } from "@base/client-auth/write-private-json"
import { toApiError } from "@/lib/to-api-error"

type EndpointTokens = {
  token: string | null
  refresh_token: string | null
}

function resolveBaseUrl(): string {
  const fromEnv = process.env.BASE_API

  if (fromEnv !== undefined && fromEnv !== "") {
    return fromEnv
  }

  return "http://127.0.0.1:18787"
}

async function readTokens(baseUrl: string): Promise<EndpointTokens> {
  const file = configFile()

  let raw: string

  try {
    raw = await readFile(file, "utf8")
  } catch {
    return { token: null, refresh_token: null }
  }

  if (raw.trim() === "") {
    return { token: null, refresh_token: null }
  }

  let value: unknown

  try {
    value = JSON.parse(raw)
  } catch {
    return { token: null, refresh_token: null }
  }

  if (typeof value !== "object" || value === null) {
    return { token: null, refresh_token: null }
  }

  const endpoints = (value as Record<string, unknown>).endpoints

  if (typeof endpoints !== "object" || endpoints === null) {
    return { token: null, refresh_token: null }
  }

  const entry = (endpoints as Record<string, unknown>)[baseUrl]

  if (typeof entry !== "object" || entry === null) {
    return { token: null, refresh_token: null }
  }

  const e = entry as Record<string, unknown>
  const accessToken =
    typeof e.accessToken === "string" && e.accessToken !== "" ? e.accessToken : null
  const refreshToken =
    typeof e.refreshToken === "string" && e.refreshToken !== "" ? e.refreshToken : null

  return { token: accessToken, refresh_token: refreshToken }
}

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

    const body = (await res.json()) as { access_token?: unknown; refresh_token?: unknown }

    if (typeof body.access_token !== "string" || body.access_token === "") {
      return null
    }

    return {
      access_token: body.access_token,
      refresh_token:
        typeof body.refresh_token === "string" && body.refresh_token !== ""
          ? body.refresh_token
          : null,
    }
  } catch {
    return null
  }
}

function configDir(): string {
  return process.env.BASE_CONFIG_DIR ?? join(homedir(), ".config", "base")
}

function configFile(): string {
  return join(configDir(), "settings.json")
}

async function writeTokens(
  baseUrl: string,
  accessToken: string,
  refreshToken: string | null,
): Promise<void> {
  const dir = configDir()
  const file = configFile()

  let root: Record<string, unknown> = { endpoints: {} }

  try {
    const raw = await readFile(file, "utf8")

    if (raw.trim() !== "") {
      const parsed = JSON.parse(raw)

      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
        throw new Error("authentication settings are invalid")
      root = { ...parsed }
    }
  } catch (error) {
    if (
      !(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
    )
      throw new Error("authentication settings could not be preserved")
  }

  const endpoints =
    typeof root.endpoints === "object" && root.endpoints !== null
      ? { ...(root.endpoints as Record<string, unknown>) }
      : {}

  const existing =
    typeof endpoints[baseUrl] === "object" && endpoints[baseUrl] !== null
      ? { ...(endpoints[baseUrl] as Record<string, unknown>) }
      : {}

  endpoints[baseUrl] = {
    ...existing,
    accessToken,
    refreshToken: refreshToken ?? "",
  }

  root.endpoints = endpoints

  await writePrivateJson({ directory: dir, file, value: root })
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  query?: Record<string, string | number | boolean | null | undefined>
  idempotencyKey?: string
  headers?: Readonly<Record<string, string | undefined>>
  json?: unknown
}

const authentication = new AuthenticationState({ resolveBaseUrl, readTokens })
const consumedRefreshTokens = new Map<string, string>()
const sessionRefreshes = new SessionRefreshCoordinator({
  refresh: (baseUrl, failedToken) =>
    new AuthFileLock({ directory: configDir() }).run(() =>
      refreshCurrentToken({
        baseUrl,
        failedToken,
        consumedRefreshTokens,
        readTokens,
        rotate: tryRefresh,
        saveTokens: writeTokens,
        updateToken: (token) => authentication.updateToken(token),
      }),
    ),
})

export async function ensureAuth(): Promise<{ baseUrl: string; token: string | null }> {
  return authentication.get()
}

type Props = Omit<RequestInit, "body"> & { body?: string | FormData }

/** 再送可能なbodyを認証付きで送り、401のときだけ後継tokenで一回やり直す。 */
export async function authenticatedFetch(path: string | URL, options: Props): Promise<Response> {
  const session = await ensureAuth()
  const headers = new Headers(options.headers)
  if (session.token !== null) headers.set("Authorization", `Bearer ${session.token}`)

  const url = new URL(path, session.baseUrl)
  const firstAttempt = new AbortController()
  const response = await fetch(url, {
    ...options,
    headers,
    signal: AbortSignal.any([options.signal ?? AbortSignal.timeout(15_000), firstAttempt.signal]),
  })
  if (response.status !== 401) return response

  const token = await sessionRefreshes
    .refresh({
      baseUrl: session.baseUrl,
      failedToken: session.token,
    })
    .catch((error: unknown) => {
      firstAttempt.abort()
      void response.body?.cancel().catch(() => undefined)
      throw error
    })
  if (token === null) return response

  // Bunの通信も解放する。cleanupの失敗や停止で再送を止めない。
  firstAttempt.abort()
  void response.body?.cancel().catch(() => undefined)
  headers.set("Authorization", `Bearer ${token}`)

  return fetch(url, { ...options, headers, signal: options.signal ?? AbortSignal.timeout(15_000) })
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const session = await ensureAuth()

  const url = new URL(path, session.baseUrl)

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = {}
  for (const header of Object.entries(options.headers ?? {})) {
    if (header[1] !== undefined) headers[header[0]] = header[1]
  }
  if (options.idempotencyKey !== undefined) headers["Idempotency-Key"] = options.idempotencyKey

  if (options.json !== undefined) {
    headers["content-type"] = "application/json"
  }

  const res = await authenticatedFetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
  })

  if (res.ok === false) {
    const contentType = res.headers.get("content-type") ?? ""
    const body = await readResponseErrorBody(res)

    throw toApiError(res.status, body, contentType)
  }

  const contentType = res.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    return (await res.json()) as T
  }

  return (await res.text()) as T
}
