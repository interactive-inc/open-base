import { afterAll, beforeAll, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createUnreadableErrorResponse } from "@base/http/create-unreadable-error-response.test-support"
import { apiRequest, authenticatedFetch } from "@/lib/api-client"

let directory = ""
let server: ReturnType<typeof Bun.serve> | undefined
const presented: string[] = []
const unreadable = { status: 0, finish: (): void => undefined }
const streaming = { first: false, released: Promise.withResolvers<void>() }

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "base-mcp-"))
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === "/system/sessions" && request.method === "PATCH") {
        const body = (await request.json()) as { refresh_token: string }
        presented.push(body.refresh_token)
        return Response.json({ access_token: "fresh-access", refresh_token: "rotated-refresh" })
      }
      if (url.pathname === "/streaming" && streaming.first) {
        streaming.first = false
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("expired"))
            },
            cancel() {
              streaming.released.resolve()
            },
          }),
          { status: 401 },
        )
      }
      if (url.pathname === "/unreadable" && unreadable.status !== 0) {
        const broken = createUnreadableErrorResponse(unreadable.status)
        unreadable.finish = broken.finish
        return broken.response
      }
      if (request.headers.get("authorization") !== "Bearer fresh-access")
        return Response.json({ error: "unauthorized" }, { status: 401 })
      return Response.json({ ok: true })
    },
  })
  const baseUrl = `http://127.0.0.1:${server.port}`
  process.env.BASE_API = baseUrl
  process.env.BASE_CONFIG_DIR = directory
  await writeFile(
    join(directory, "settings.json"),
    JSON.stringify({
      endpoints: { [baseUrl]: { accessToken: "expired-access", refreshToken: "first-refresh" } },
    }),
  )
})

afterAll(async () => {
  await server?.stop(true)
  await rm(directory, { recursive: true, force: true })
})

test("401で更新したら、入れ替わった refresh token を保存して次の更新に使う", async () => {
  expect(
    await Promise.all([
      apiRequest<{ ok: boolean }>("/employees"),
      apiRequest<{ ok: boolean }>("/employees"),
    ]),
  ).toEqual([{ ok: true }, { ok: true }])
  expect(presented).toEqual(["first-refresh"])
  const saved = JSON.parse(await readFile(join(directory, "settings.json"), "utf8"))
  expect(saved.endpoints[`http://127.0.0.1:${server?.port}`]).toMatchObject({
    accessToken: "fresh-access",
    refreshToken: "rotated-refresh",
  })
})

test("401 bodyの取消し失敗でも更新済みtokenで再送する", async () => {
  const originalFetch = globalThis.fetch
  const requests = { first: true, attempts: 0 }
  const intercepted = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    if (new URL(input instanceof Request ? input.url : input).pathname === "/system/health") {
      requests.attempts += 1
      if (requests.first) {
        requests.first = false
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error("example-initial-body-error"))
            },
          }),
          { status: 401 },
        )
      }
    }
    return originalFetch(input, init)
  }
  globalThis.fetch = Object.assign(intercepted, { preconnect: originalFetch.preconnect })
  try {
    const response = await authenticatedFetch("/system/health", { method: "GET" })
    expect(await response.json()).toEqual({ ok: true })
    expect(requests.attempts).toBe(2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("401 bodyの取消しが停止しても更新済みtokenで再送する", async () => {
  const baseUrl = `http://127.0.0.1:${server?.port}`
  await writeFile(
    join(directory, "settings.json"),
    JSON.stringify({
      endpoints: { [baseUrl]: { accessToken: "fresh-access", refreshToken: "third-refresh" } },
    }),
  )
  const originalFetch = globalThis.fetch
  const release = Promise.withResolvers<void>()
  const lifecycle = { first: true, cancellations: 0, attempts: 0 }
  const intercepted = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    if (new URL(input instanceof Request ? input.url : input).pathname === "/system/health") {
      lifecycle.attempts += 1
      if (lifecycle.first) {
        lifecycle.first = false
        return new Response(
          new ReadableStream({
            cancel() {
              lifecycle.cancellations += 1
              return release.promise
            },
          }),
          { status: 401 },
        )
      }
    }
    return originalFetch(input, init)
  }
  globalThis.fetch = Object.assign(intercepted, { preconnect: originalFetch.preconnect })
  const completion = authenticatedFetch("/system/health", { method: "GET" })
  try {
    expect(
      await Promise.race([completion.then(() => true), Bun.sleep(500).then(() => false)]),
    ).toBe(true)
    expect(await (await completion).json()).toEqual({ ok: true })
    expect(lifecycle.cancellations).toBe(1)
    expect(lifecycle.attempts).toBe(2)
  } finally {
    release.resolve()
    await completion.catch(() => undefined)
    globalThis.fetch = originalFetch
  }
})

test("更新後の再送では最初の401のBun通信も解放する", async () => {
  const baseUrl = `http://127.0.0.1:${server?.port}`
  await writeFile(
    join(directory, "settings.json"),
    JSON.stringify({
      endpoints: { [baseUrl]: { accessToken: "fresh-access", refreshToken: "stream-refresh" } },
    }),
  )
  streaming.first = true
  streaming.released = Promise.withResolvers<void>()
  const response = await authenticatedFetch("/streaming", { method: "GET" })
  expect(await response.json()).toEqual({ ok: true })
  expect(
    await Promise.race([
      streaming.released.promise.then(() => true),
      Bun.sleep(250).then(() => false),
    ]),
  ).toBe(true)
})

test("最初の要求のabortを呼出し側と再送へ伝播させない", async () => {
  const baseUrl = `http://127.0.0.1:${server?.port}`
  await writeFile(
    join(directory, "settings.json"),
    JSON.stringify({
      endpoints: { [baseUrl]: { accessToken: "fresh-access", refreshToken: "caller-refresh" } },
    }),
  )
  const originalFetch = globalThis.fetch
  const caller = new AbortController()
  const requests = { first: true, signals: new Array<AbortSignal | null | undefined>() }
  const intercepted = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    if (new URL(input instanceof Request ? input.url : input).pathname === "/system/health") {
      requests.signals.push(init?.signal)
      if (requests.first) {
        requests.first = false
        return new Response("expired", { status: 401 })
      }
    }
    return originalFetch(input, init)
  }
  globalThis.fetch = Object.assign(intercepted, { preconnect: originalFetch.preconnect })
  try {
    const response = await authenticatedFetch("/system/health", {
      method: "GET",
      signal: caller.signal,
    })
    expect(await response.json()).toEqual({ ok: true })
    expect(requests.signals).toHaveLength(2)
    expect(requests.signals[0]?.aborted).toBe(true)
    expect(requests.signals[1]).toBe(caller.signal)
    expect(caller.signal.aborted).toBe(false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("呼出し側が中断した要求を再送しない", async () => {
  const caller = new AbortController()
  caller.abort()
  const before = presented.length
  const failure = await authenticatedFetch("/system/health", {
    method: "GET",
    signal: caller.signal,
  }).catch((error: unknown) => error)
  expect(failure).toMatchObject({ name: "AbortError" })
  expect(presented.length).toBe(before)
})

test("更新結果を保存できない場合も最初の401通信を解放する", async () => {
  const baseUrl = `http://127.0.0.1:${server?.port}`
  const file = join(directory, "settings.json")
  const original = JSON.stringify({
    endpoints: { [baseUrl]: { accessToken: "fresh-access", refreshToken: "save-failure-refresh" } },
  })
  await writeFile(file, original)
  const originalFetch = globalThis.fetch
  const intercepted = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const response = await originalFetch(input, init)
    if (init?.method === "PATCH") {
      await rm(file)
      await mkdir(file)
    }
    return response
  }
  streaming.first = true
  streaming.released = Promise.withResolvers<void>()
  globalThis.fetch = Object.assign(intercepted, { preconnect: originalFetch.preconnect })
  try {
    const failure = await authenticatedFetch("/streaming", { method: "GET" }).catch(
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(Error)
    if (!(failure instanceof Error)) throw new Error("expected persistence error")
    expect(failure.message).toBe("authentication settings could not be preserved")
    expect(
      await Promise.race([
        streaming.released.promise.then(() => true),
        Bun.sleep(250).then(() => false),
      ]),
    ).toBe(true)
  } finally {
    globalThis.fetch = originalFetch
    await rm(file, { recursive: true, force: true })
    await writeFile(file, original)
  }
})

for (const status of [429, 503]) {
  test(`本文の読取失敗でもAPI ${status}を保持する`, async () => {
    unreadable.status = status
    const originalFetch = globalThis.fetch
    const intercepted = async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ): Promise<Response> => {
      const response = await originalFetch(input, init)
      if (new URL(input instanceof Request ? input.url : input).pathname === "/unreadable")
        unreadable.finish()
      return response
    }
    globalThis.fetch = Object.assign(intercepted, { preconnect: originalFetch.preconnect })
    try {
      const failure = await apiRequest("/unreadable").catch((error: unknown) => error)
      expect(failure).toBeInstanceOf(Error)
      if (!(failure instanceof Error)) throw new Error("expected API error")
      expect(failure.message).toBe(`API ${status}: 応答本文を読み取れませんでした`)
      expect(failure.message).not.toContain("example-unreadable-body")
    } finally {
      globalThis.fetch = originalFetch
      unreadable.status = 0
    }
  })
}
