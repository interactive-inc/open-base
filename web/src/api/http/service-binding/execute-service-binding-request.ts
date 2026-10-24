import type { Bindings } from "@/bindings"
import { resolveSystemServiceBindingAccount } from "@system/interface/operations/resolve-system-service-binding-account"
import { SystemServiceBindingAccountChannel } from "@system/interface/request-environment/system-service-binding-account-channel"
import { z } from "zod"

/** Service Binding RPCの `request` が返す値。structured cloneで渡せる値だけを持つ。 */
export type ServiceBindingRequestResult =
  | Readonly<{
      ok: true
      status: number
      headers: Readonly<{ contentType: string | null }>
      /** JSON応答は解析した値、それ以外は文字列。本文が無ければnull。 */
      body: unknown
      /** 本文が上限を超えて切り詰められたならtrue。切り詰めた本文は文字列で返す。 */
      truncated: boolean
    }>
  | Readonly<{ ok: false; reason: "rejected" | "unavailable" }>

/** Service Binding RPCの `request` が受け取る要求。実行時にはすべての項目を検証し直す。 */
export type ServiceBindingRequestInput = Readonly<{
  method: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE"
  /** 先頭が `/` の絶対path。queryは含めず `query` で渡す。 */
  path: string
  query?: Readonly<Record<string, string>>
  /** JSONとして送る本文。GET・HEADでは渡さない。 */
  body?: unknown
}>

type ServiceBindingApp = Readonly<{
  fetch(
    request: Request,
    env: Bindings,
    executionContext?: ExecutionContext,
  ): Response | Promise<Response>
}>

type Props = Readonly<{
  app: ServiceBindingApp
  env: Bindings
  executionContext: ExecutionContext | null
  accessToken: unknown
  input: unknown
}>

const MAX_PATH_LENGTH = 2_048
const MAX_QUERY_ENTRIES = 100
const MAX_REQUEST_BODY_BYTES = 1_000_000
const MAX_RESPONSE_BODY_BYTES = 1_000_000

/**
 * 認証済み主体から別の資格情報を発行する経路。RPCで受理したtokenを、
 * HTTPやブラウザで使える長命の資格情報へ変えさせないため、RPCからは呼ばせない。
 */
const CREDENTIAL_ISSUING_PATHS: ReadonlySet<string> = new Set([
  "/system/browser-login-codes",
  "/system/oauth/authorizations",
  "/system/oauth/mcp-grants",
])

const rejected: ServiceBindingRequestResult = Object.freeze({ ok: false, reason: "rejected" })
const unavailable: ServiceBindingRequestResult = Object.freeze({
  ok: false,
  reason: "unavailable",
})

const inputSchema = z.strictObject({
  method: z.enum(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().min(1).max(MAX_PATH_LENGTH),
  query: z.record(z.string().min(1).max(200), z.string().max(2_000)).optional(),
  body: z.unknown().optional(),
})

type Input = z.output<typeof inputSchema>

/** 先頭が `/` の絶対pathで、scheme・host・`.`/`..`・query・fragment・制御文字を含まないか。 */
function isSafePath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false
  if (/[\\?#\s\p{Cc}]/u.test(path)) return false
  for (const segment of path.split("/")) {
    const decoded = decodePathSegment(segment)
    if (decoded === null || decoded === "." || decoded === ".." || decoded.includes("/")) {
      return false
    }
  }
  return new URL(path, "http://localhost").pathname === path
}

function decodePathSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

/**
 * routerは百分率符号化を戻してから経路を選ぶため、戻した綴りで比べる。
 * 大文字小文字と末尾の `/` の違いも同じ経路として扱う。
 */
function isCredentialIssuingPath(path: string): boolean {
  const decoded = path
    .split("/")
    .map((segment) => decodePathSegment(segment) ?? segment)
    .join("/")
  return CREDENTIAL_ISSUING_PATHS.has(decoded.replace(/\/+$/u, "").toLowerCase())
}

/** queryの件数を、各項目を検証する前に数える。 */
function hasTooManyQueryEntries(input: unknown): boolean {
  if (typeof input !== "object" || input === null || !("query" in input)) return false
  const query = input.query
  return (
    typeof query === "object" && query !== null && Object.keys(query).length > MAX_QUERY_ENTRIES
  )
}

/** 本文をJSONへ直す。GET・HEADの本文、直せない値、上限を超える値はnull。 */
function toRequestBody(input: Input): string | null | Error {
  if (input.body === undefined) return null
  if (input.method === "GET" || input.method === "HEAD") return new Error("body is not allowed")
  try {
    const serialized = JSON.stringify(input.body)
    if (serialized === undefined) return new Error("body is not serializable")
    if (new TextEncoder().encode(serialized).byteLength > MAX_REQUEST_BODY_BYTES) {
      return new Error("body is too large")
    }
    return serialized
  } catch {
    return new Error("body is not serializable")
  }
}

function toRequestUrl(env: Bindings, input: Input): URL {
  const origin = readOrigin(env.API_ORIGIN)
  const url = new URL(input.path, origin)
  for (const [key, value] of Object.entries(input.query ?? {})) {
    url.searchParams.append(key, value)
  }
  return url
}

function readOrigin(value: string | undefined): string {
  if (value === undefined || value.length === 0) return "http://localhost"
  try {
    return new URL(value).origin
  } catch {
    return "http://localhost"
  }
}

/** 応答本文を上限まで読む。上限を超えたら読むのをやめ、切り詰めたことを返す。 */
async function readLimitedBody(
  response: Response,
): Promise<Readonly<{ bytes: Uint8Array; truncated: boolean }>> {
  const reader = response.body?.getReader()
  if (reader === undefined) return { bytes: new Uint8Array(), truncated: false }

  const chunks: Uint8Array[] = []
  const total = { bytes: 0 }
  for (;;) {
    const chunk = await reader.read()
    if (chunk.done) break
    const remaining = MAX_RESPONSE_BODY_BYTES - total.bytes
    if (chunk.value.byteLength > remaining) {
      chunks.push(chunk.value.subarray(0, remaining))
      total.bytes += remaining
      await reader.cancel()
      return { bytes: concat(chunks, total.bytes), truncated: true }
    }
    chunks.push(chunk.value)
    total.bytes += chunk.value.byteLength
  }
  return { bytes: concat(chunks, total.bytes), truncated: false }
}

function concat(chunks: ReadonlyArray<Uint8Array>, length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  const offset = { value: 0 }
  for (const chunk of chunks) {
    bytes.set(chunk, offset.value)
    offset.value += chunk.byteLength
  }
  return bytes
}

async function toResult(
  response: Response,
  method: Input["method"],
): Promise<ServiceBindingRequestResult> {
  const contentType = response.headers.get("content-type")
  if (method === "HEAD") {
    await response.body?.cancel()
    return {
      ok: true,
      status: response.status,
      headers: { contentType },
      body: null,
      truncated: false,
    }
  }
  const read = await readLimitedBody(response)
  // 切り詰めたときは末尾の不完全なUTF-8文字を捨て、置換文字を足さない。
  const text = new TextDecoder().decode(read.bytes, { stream: read.truncated })
  const isJson = contentType !== null && /^application\/(?:[\w.+-]+\+)?json\b/iu.test(contentType)
  const status = response.status
  if (text.length === 0)
    return { ok: true, status, headers: { contentType }, body: null, truncated: read.truncated }
  if (read.truncated || !isJson)
    return { ok: true, status, headers: { contentType }, body: text, truncated: read.truncated }
  return { ok: true, status, headers: { contentType }, body: parseJson(text), truncated: false }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * 同じCloudflare accountのWorkerからService Binding RPCで渡された要求を、
 * access tokenの本人としてHTTPと同じappで処理する。
 * 本人はAuthorization headerではなくenvの複製に結び付けて渡すため、HTTP要求からは作れない。
 * routing、入力検証、認可、監査、エラー形状はHTTPの呼び出しと同じになる。
 */
export async function executeServiceBindingRequest(
  props: Props,
): Promise<ServiceBindingRequestResult> {
  if (hasTooManyQueryEntries(props.input)) return rejected
  const input = inputSchema.safeParse(props.input)
  if (!input.success) return rejected
  if (!isSafePath(input.data.path) || isCredentialIssuingPath(input.data.path)) return rejected
  const body = toRequestBody(input.data)
  if (body instanceof Error) return rejected

  const resolution = await resolveSystemServiceBindingAccount(
    { env: props.env },
    { accessToken: props.accessToken, now: new Date(props.env.NOW ?? Date.now()) },
  ).catch(() => ({ kind: "unavailable" }) satisfies Readonly<{ kind: "unavailable" }>)
  if (resolution.kind === "rejected") return rejected
  if (resolution.kind === "unavailable") return unavailable

  const headers = new Headers({ accept: "application/json" })
  if (body !== null) headers.set("content-type", "application/json")
  const request = new Request(toRequestUrl(props.env, input.data).toString(), {
    method: input.data.method,
    headers,
    body,
  })
  const env = new SystemServiceBindingAccountChannel({ env: props.env }).attach(resolution.account)
  const response = await fetchApp(props, request, env)
  if (response instanceof Error) return unavailable
  // appが応答した後は処理が確定している。本文を読めなくても失敗として返さず、状態だけを返す。
  return await toResult(response, input.data.method).catch(() => ({
    ok: true,
    status: response.status,
    headers: { contentType: response.headers.get("content-type") },
    body: null,
    truncated: true,
  }))
}

async function fetchApp(props: Props, request: Request, env: Bindings): Promise<Response | Error> {
  try {
    return await props.app.fetch(request, env, props.executionContext ?? undefined)
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("service binding request failed")
  }
}
