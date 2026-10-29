import { afterAll, afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SettingsFile } from "@/lib/config/settings-file"
import { createClient } from "@/lib/http/hc-client"
import { ApiError } from "@/lib/errors"

const previous = { directory: process.env.BASE_CONFIG_DIR, api: process.env.BASE_API }
const fixture = { directory: "", generation: 0, denied: false, headers: new Array<string | null>() }
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
    if (fixture.denied) return Response.json({ error: "forbidden" }, { status: 403 })
    if (request.headers.get("authorization") === `Bearer example-access-${fixture.generation}`) {
      return Response.json({ ok: true })
    }
    return Response.json({ error: "expired" }, { status: 401 })
  },
})

beforeEach(async () => {
  fixture.directory = await mkdtemp(join(tmpdir(), "base-hc-client-"))
  fixture.generation = 1
  fixture.denied = false
  fixture.headers.length = 0
  process.env.BASE_CONFIG_DIR = fixture.directory
  process.env.BASE_API = `http://127.0.0.1:${server.port}`
  await new SettingsFile().saveTokens(process.env.BASE_API, {
    token: "example-access-0",
    refresh_token: "example-refresh-0",
  })
})

afterEach(async () => {
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
