import { afterAll, afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createUnreadableErrorResponse } from "@base/http/create-unreadable-error-response.test-support"
import { SettingsFile } from "@/lib/config/settings-file"
import { createClient } from "@/lib/http/hc-client"
import { ApiError } from "@/lib/errors"

const previous = { directory: process.env.BASE_CONFIG_DIR, api: process.env.BASE_API }
const fixture = {
  directory: "",
  generation: 0,
  denied: false,
  headers: new Array<string | null>(),
  streaming: false,
  unreadable: false,
  finish: (): void => undefined,
  released: Promise.withResolvers<void>(),
  controllers: new Array<ReadableStreamDefaultController<Uint8Array>>(),
}
const server = Bun.serve({
  port: 0,
  fetch(request) {
    if (request.method === "PATCH") {
      fixture.generation += 1
      return Response.json({
        access_token: `example-access-${fixture.generation}`,
        refresh_token: `example-refresh-${fixture.generation}`,
      })
    }
    fixture.headers.push(request.headers.get("authorization"))
    if (fixture.denied) {
      if (fixture.unreadable) {
        const broken = createUnreadableErrorResponse(403)
        fixture.finish = broken.finish
        return broken.response
      }
      return Response.json({ error: "forbidden" }, { status: 403 })
    }
    if (request.headers.get("authorization") === `Bearer example-access-${fixture.generation}`) {
      return Response.json({ workItems: [], nextCursor: null })
    }
    if (fixture.streaming)
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            fixture.controllers.push(controller)
            controller.enqueue(new TextEncoder().encode("expired"))
          },
          cancel() {
            fixture.released.resolve()
          },
        }),
        { status: 401 },
      )
    return Response.json({ error: "expired" }, { status: 401 })
  },
})

beforeEach(async () => {
  fixture.directory = await mkdtemp(join(tmpdir(), "base-hc-client-"))
  fixture.generation = 1
  fixture.denied = false
  fixture.headers.length = 0
  fixture.streaming = false
  fixture.unreadable = false
  fixture.released = Promise.withResolvers<void>()
  fixture.controllers.length = 0
  process.env.BASE_CONFIG_DIR = fixture.directory
  process.env.BASE_API = `http://127.0.0.1:${server.port}`
  await new SettingsFile().saveTokens(process.env.BASE_API, {
    token: "example-access-0",
    refresh_token: "example-refresh-0",
  })
})

afterEach(async () => {
  for (const controller of fixture.controllers) {
    try {
      controller.close()
    } catch {
      continue
    }
  }
  if (previous.directory === undefined) delete process.env.BASE_CONFIG_DIR
  else process.env.BASE_CONFIG_DIR = previous.directory
  if (previous.api === undefined) delete process.env.BASE_API
  else process.env.BASE_API = previous.api
  await rm(fixture.directory, { recursive: true, force: true })
})
afterAll(() => server.stop(true))

test("a reused client sends the rotated token and can refresh again after another expiry", async () => {
  const client = await createClient()

  expect((await client.system["work-items"].$get({ query: {} })).status).toBe(200)
  expect((await client.system["work-items"].$get({ query: {} })).status).toBe(200)
  expect(fixture.headers).toEqual([
    "Bearer example-access-0",
    "Bearer example-access-2",
    "Bearer example-access-2",
  ])
  fixture.generation = 3

  expect((await client.system["work-items"].$get({ query: {} })).status).toBe(200)
  expect(fixture.generation).toBe(4)
})

test("the response from the authenticated retry still uses the ApiError contract", async () => {
  const client = await createClient()
  const originalFetch = globalThis.fetch
  const intercepted = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const response = await originalFetch(input, init)
    if (init?.method === "PATCH") fixture.denied = true
    return response
  }
  globalThis.fetch = Object.assign(intercepted, { preconnect: originalFetch.preconnect })

  try {
    const failure = await client.system["work-items"]
      .$get({ query: {} })
      .catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ApiError)
    if (!(failure instanceof ApiError)) throw new Error("expected ApiError")
    expect(failure.status).toBe(403)
  } finally {
    globalThis.fetch = originalFetch
  }
})

for (const hasRefreshed of [false, true]) {
  test(`an explicit bearer cannot fall back to the stored account after a 401 (refreshed=${hasRefreshed})`, async () => {
    fixture.generation = hasRefreshed ? 1 : 0
    const client = await createClient()
    if (hasRefreshed) await client.system["work-items"].$get({ query: {} })
    const saved = await new SettingsFile().tokensFor(process.env.BASE_API ?? "")
    const generation = fixture.generation
    fixture.headers.length = 0
    const failure = await client.company["current-profile"]
      .$get({}, { headers: { Authorization: "Bearer rejected-explicit-account" } })
      .catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ApiError)
    if (!(failure instanceof ApiError)) throw new Error("expected explicit bearer rejection")
    expect(failure.status).toBe(401)
    expect(fixture.headers).toEqual(["Bearer rejected-explicit-account"])
    expect(fixture.generation).toBe(generation)
    expect(await new SettingsFile().tokensFor(process.env.BASE_API ?? "")).toEqual(saved)
  })
}

test("an accepted explicit bearer is preserved without replacing the saved session", async () => {
  const client = await createClient()
  const response = await client.company["current-profile"].$get(
    {},
    { headers: { Authorization: "Bearer example-access-1" } },
  )

  expect(response.status).toBe(200)
  expect(fixture.headers).toEqual(["Bearer example-access-1"])
  expect(fixture.generation).toBe(1)
  expect(await new SettingsFile().tokensFor(process.env.BASE_API ?? "")).toEqual({
    token: "example-access-0",
    refresh_token: "example-refresh-0",
  })
})

test("a refreshed request releases the first streaming 401 body", async () => {
  fixture.streaming = true
  const client = await createClient()
  const response = await client.system["work-items"].$get({ query: {} })
  expect(await response.json()).toEqual({ workItems: [], nextCursor: null })
  expect(
    await Promise.race([
      fixture.released.promise.then(() => true),
      Bun.sleep(250).then(() => false),
    ]),
  ).toBe(true)
  expect(fixture.headers).toEqual(["Bearer example-access-0", "Bearer example-access-2"])
})

test("a failed first-body cancellation does not discard a successful refresh", async () => {
  const client = await createClient()
  const originalFetch = globalThis.fetch
  const intercepted = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const response = await originalFetch(input, init)
    if (response.status !== 401) return response
    await response.body?.cancel()
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new Error("example-initial-body-error"))
        },
      }),
      { status: 401 },
    )
  }
  globalThis.fetch = Object.assign(intercepted, { preconnect: originalFetch.preconnect })
  try {
    const response = await client.system["work-items"].$get({ query: {} })
    expect(await response.json()).toEqual({ workItems: [], nextCursor: null })
    expect(fixture.headers).toEqual(["Bearer example-access-0", "Bearer example-access-2"])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("a stalled first-body cancellation does not hold the authenticated retry", async () => {
  const client = await createClient()
  const originalFetch = globalThis.fetch
  const release = Promise.withResolvers<void>()
  const lifecycle = { cancellations: 0 }
  const intercepted = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const response = await originalFetch(input, init)
    if (response.status !== 401) return response
    await response.body?.cancel()
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
  globalThis.fetch = Object.assign(intercepted, { preconnect: originalFetch.preconnect })
  const completion = client.system["work-items"].$get({ query: {} })
  try {
    expect(
      await Promise.race([completion.then(() => true), Bun.sleep(500).then(() => false)]),
    ).toBe(true)
    expect(await (await completion).json()).toEqual({ workItems: [], nextCursor: null })
    expect(lifecycle.cancellations).toBe(1)
    expect(fixture.headers).toEqual(["Bearer example-access-0", "Bearer example-access-2"])
  } finally {
    release.resolve()
    await completion.catch(() => undefined)
    globalThis.fetch = originalFetch
  }
})

test("releasing the first request preserves the caller signal for the retry", async () => {
  const client = await createClient()
  const caller = new AbortController()
  const originalFetch = globalThis.fetch
  const signals = new Array<AbortSignal | null | undefined>()
  const intercepted = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    if (init?.method !== "PATCH") signals.push(init?.signal)
    return originalFetch(input, init)
  }
  globalThis.fetch = Object.assign(intercepted, { preconnect: originalFetch.preconnect })
  try {
    const response = await client.system["work-items"].$get(
      { query: {} },
      { init: { signal: caller.signal } },
    )
    expect(await response.json()).toEqual({ workItems: [], nextCursor: null })
    expect(signals).toHaveLength(2)
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]).toBe(caller.signal)
    expect(caller.signal.aborted).toBe(false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("a caller-aborted request does not refresh or retry", async () => {
  const client = await createClient()
  const caller = new AbortController()
  caller.abort()
  const failure = await client.system["work-items"]
    .$get({ query: {} }, { init: { signal: caller.signal } })
    .catch((error: unknown) => error)
  expect(failure).toMatchObject({ name: "AbortError" })
  expect(fixture.generation).toBe(1)
  expect(fixture.headers).toEqual([])
})

test("refresh persistence failures also release the first streaming response", async () => {
  const client = await createClient()
  await rm(join(fixture.directory, "settings.json"))
  await mkdir(join(fixture.directory, "settings.json"))
  fixture.streaming = true
  const failure = await client.system["work-items"]
    .$get({ query: {} })
    .catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(Error)
  expect(fixture.generation).toBe(1)
  expect(
    await Promise.race([
      fixture.released.promise.then(() => true),
      Bun.sleep(250).then(() => false),
    ]),
  ).toBe(true)
})

for (const afterRefresh of [false, true]) {
  test(`keeps HTTP 403 with an unreadable body (afterRefresh=${afterRefresh})`, async () => {
    fixture.denied = !afterRefresh
    fixture.unreadable = true
    const client = await createClient()
    const originalFetch = globalThis.fetch
    const intercepted = async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ): Promise<Response> => {
      const response = await originalFetch(input, init)
      if (init?.method === "PATCH") fixture.denied = true
      if (response.status === 403) fixture.finish()
      return response
    }
    globalThis.fetch = Object.assign(intercepted, { preconnect: originalFetch.preconnect })
    try {
      const failure = await client.system["work-items"]
        .$get({ query: {} })
        .catch((error: unknown) => error)
      expect(failure).toBeInstanceOf(ApiError)
      if (!(failure instanceof ApiError)) throw new Error("expected ApiError")
      expect(failure.status).toBe(403)
      expect(failure.message).toContain("応答本文を読み取れませんでした")
      expect(failure.message).not.toContain("example-unreadable-body")
    } finally {
      globalThis.fetch = originalFetch
    }
  })
}

test("a caller abort during an error body remains a caller abort", async () => {
  fixture.denied = true
  fixture.unreadable = true
  const client = await createClient()
  const caller = new AbortController()
  const originalFetch = globalThis.fetch
  const intercepted = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const response = await originalFetch(input, init)
    if (response.status === 403) caller.abort()
    return response
  }
  globalThis.fetch = Object.assign(intercepted, { preconnect: originalFetch.preconnect })
  try {
    const failure = await client.system["work-items"]
      .$get({ query: {} }, { init: { signal: caller.signal } })
      .catch((error: unknown) => error)
    expect(failure).toMatchObject({ name: "AbortError" })
    expect(fixture.generation).toBe(1)
  } finally {
    globalThis.fetch = originalFetch
  }
})
