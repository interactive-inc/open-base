import { afterAll, afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createUnreadableErrorResponse } from "@base/http/create-unreadable-error-response.test-support"
import { api } from "@/lib/http/client"
import { ApiError } from "@/lib/errors"
import { SettingsFile } from "@/lib/config/settings-file"

const originalEnvironment = {
  baseApi: process.env.BASE_API,
  configDir: process.env.BASE_CONFIG_DIR,
}
const fixture = {
  directory: "",
  body: "",
  status: 503,
  refreshes: 0,
  unreadable: false,
  finish: (): void => undefined,
}
const server = Bun.serve({
  port: 0,
  fetch(request) {
    if (request.method === "PATCH") {
      fixture.refreshes += 1
      return Response.json({ access_token: "example-fresh", refresh_token: "example-rotated" })
    }
    if (fixture.status === 401 && request.headers.get("authorization") === "Bearer example-fresh") {
      return Response.json({ ok: true })
    }
    if (fixture.unreadable) {
      const broken = createUnreadableErrorResponse(fixture.status)
      fixture.finish = broken.finish
      return broken.response
    }
    return new Response(fixture.body, { status: fixture.status })
  },
})

afterAll(() => server.stop(true))

beforeEach(async () => {
  fixture.directory = await mkdtemp(join(tmpdir(), "base-client-"))
  fixture.refreshes = 0
  fixture.unreadable = false
  process.env.BASE_API = `http://127.0.0.1:${server.port}`
  process.env.BASE_CONFIG_DIR = fixture.directory
})

afterEach(async () => {
  if (originalEnvironment.baseApi === undefined) delete process.env.BASE_API
  else process.env.BASE_API = originalEnvironment.baseApi
  if (originalEnvironment.configDir === undefined) delete process.env.BASE_CONFIG_DIR
  else process.env.BASE_CONFIG_DIR = originalEnvironment.configDir
  await rm(fixture.directory, { recursive: true, force: true })
})

test.each(["<html>unavailable</html>", "unavailable", "", '{"error":"unavailable"}'])(
  "preserves HTTP status when the error body is %s",
  async (body) => {
    fixture.body = body
    fixture.status = 503

    const failure = await api("/system/work-items").catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ApiError)
    if (!(failure instanceof ApiError)) throw new Error("expected ApiError")
    expect(failure.status).toBe(503)
    expect(failure.message).toContain(body)
  },
)

test("refreshes after a non-JSON 401 and retries the original request", async () => {
  fixture.body = "expired"
  fixture.status = 401
  await new SettingsFile().saveTokens(`http://127.0.0.1:${server.port}`, {
    token: "example-expired",
    refresh_token: "example-refresh",
  })

  expect(await api<{ ok: boolean }>("/system/work-items")).toEqual({ ok: true })
  expect(fixture.refreshes).toBe(1)
})

for (const status of [429, 503] satisfies ReadonlyArray<429 | 503>) {
  test(`keeps HTTP ${status} when its body cannot be read`, async () => {
    fixture.status = status
    fixture.unreadable = true
    const originalFetch = globalThis.fetch
    const intercepted = async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ): Promise<Response> => {
      const response = await originalFetch(input, init)
      if (!response.ok) fixture.finish()
      return response
    }
    globalThis.fetch = Object.assign(intercepted, { preconnect: originalFetch.preconnect })
    try {
      const failure = await api("/system/work-items").catch((error: unknown) => error)
      expect(failure).toBeInstanceOf(ApiError)
      if (!(failure instanceof ApiError)) throw new Error("expected ApiError")
      expect(failure.status).toBe(status)
      expect(failure.message).toContain("応答本文を読み取れませんでした")
      expect(failure.message).not.toContain("example-unreadable-body")
    } finally {
      globalThis.fetch = originalFetch
    }
  })
}

test("refreshes a known 401 even when its body cannot be read", async () => {
  fixture.status = 401
  fixture.unreadable = true
  await new SettingsFile().saveTokens(`http://127.0.0.1:${server.port}`, {
    token: "example-expired",
    refresh_token: "example-refresh",
  })
  const originalFetch = globalThis.fetch
  const intercepted = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const response = await originalFetch(input, init)
    if (!response.ok) fixture.finish()
    return response
  }
  globalThis.fetch = Object.assign(intercepted, { preconnect: originalFetch.preconnect })
  try {
    expect(await api<{ ok: boolean }>("/system/work-items")).toEqual({ ok: true })
    expect(fixture.refreshes).toBe(1)
  } finally {
    globalThis.fetch = originalFetch
  }
})
