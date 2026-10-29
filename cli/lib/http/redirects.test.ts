import { afterAll, afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { api } from "@/lib/http/client"
import { createClient } from "@/lib/http/hc-client"
import { SettingsFile } from "@/lib/config/settings-file"
import { ApiError } from "@/lib/errors"

const previous = { api: process.env.BASE_API, directory: process.env.BASE_CONFIG_DIR }
const fixture = {
  directory: "",
  mode: "initial",
  status: 307,
  source: new Array<string>(),
  target: new Array<{
    method: string
    authorization: string | null
    stepUp: string | null
    body: string
  }>(),
}
const target = Bun.serve({
  port: 0,
  async fetch(request) {
    fixture.target.push({
      method: request.method,
      authorization: request.headers.get("authorization"),
      stepUp: request.headers.get("x-system-step-up"),
      body: await request.text(),
    })
    return Response.json({
      access_token: "foreign-access",
      refresh_token: "foreign-refresh",
      ok: true,
    })
  },
})
const source = Bun.serve({
  port: 0,
  fetch(request) {
    const path = new URL(request.url).pathname
    fixture.source.push(request.method + " " + path)
    if (path === "/outside") return Response.json({ ok: true })
    const location =
      fixture.mode === "same-origin"
        ? new URL("/outside", request.url).href
        : new URL("/target", target.url).href
    if (request.method === "PATCH" && path === "/system/sessions") {
      if (fixture.mode === "refresh")
        return new Response(null, { status: fixture.status, headers: { location } })
      return Response.json({ access_token: "fresh-access", refresh_token: "fresh-refresh" })
    }
    if (fixture.mode === "refresh" || fixture.mode === "retry") {
      if (request.headers.get("authorization") === "Bearer example-access")
        return Response.json({ error: "expired" }, { status: 401 })
      if (fixture.mode === "refresh") return Response.json({ ok: true })
    }
    return new Response(null, { status: fixture.status, headers: { location } })
  },
})
beforeEach(async () => {
  fixture.directory = await mkdtemp(join(tmpdir(), "base-redirect-"))
  fixture.mode = "initial"
  fixture.status = 307
  fixture.source.length = 0
  fixture.target.length = 0
  process.env.BASE_API = source.url.origin
  process.env.BASE_CONFIG_DIR = fixture.directory
  await new SettingsFile().saveTokens(source.url.origin, {
    token: "example-access",
    refresh_token: "example-refresh",
  })
})
afterEach(async () => {
  if (previous.api === undefined) delete process.env.BASE_API
  else process.env.BASE_API = previous.api
  if (previous.directory === undefined) delete process.env.BASE_CONFIG_DIR
  else process.env.BASE_CONFIG_DIR = previous.directory
  await rm(fixture.directory, { recursive: true, force: true })
})
afterAll(async () => {
  await source.stop(true)
  await target.stop(true)
})

test("API redirectでbodyと再認証headerを別originへ転送しない", async () => {
  const failure = await api("/system/work-items", {
    method: "POST",
    json: { reason: "example-command" },
    stepUpToken: "1".repeat(64),
  }).catch((error: unknown) => error)
  expect(fixture.target).toEqual([])
  expect(failure).toBeInstanceOf(Error)
  expect(fixture.source).toEqual(["POST /system/work-items"])
})

test("refresh redirectへtokenを転送せず、接続先の認証を変えない", async () => {
  fixture.mode = "refresh"
  const before = await new SettingsFile().tokensFor(source.url.origin)
  const failure = await api("/system/work-items").catch((error: unknown) => error)
  expect(fixture.target).toEqual([])
  expect(failure).toBeInstanceOf(ApiError)
  if (!(failure instanceof ApiError)) throw new Error("expected unauthorized")
  expect(failure.status).toBe(401)
  expect(await new SettingsFile().tokensFor(source.url.origin)).toEqual(before)
})

for (const status of [301, 302, 303, 307, 308]) {
  test(`型付きclientは${status}で資格情報を転送しない`, async () => {
    fixture.status = status
    const client = await createClient(null, { authentication: "none" })
    const failure = await client.system.sessions
      .$post({ json: { subject: "you@example.com", password: "example-password" } })
      .catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(Error)
    expect(fixture.target).toEqual([])
    expect(fixture.source).toEqual(["POST /system/sessions"])
  })
}

test("型付きclientのrefresh後の再送もredirectを追従しない", async () => {
  fixture.mode = "retry"
  const client = await createClient()
  const failure = await client.system["work-items"]
    .$get({ query: {} })
    .catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(Error)
  expect(fixture.target).toEqual([])
  expect(fixture.source).toEqual([
    "GET /system/work-items",
    "PATCH /system/sessions",
    "GET /system/work-items",
  ])
  expect((await new SettingsFile().tokensFor(source.url.origin)).token).toBe("fresh-access")
})

test("型付きclientのrefreshもredirectを追従しない", async () => {
  fixture.mode = "refresh"
  const before = await new SettingsFile().tokensFor(source.url.origin)
  const client = await createClient()
  const failure = await client.system["work-items"]
    .$get({ query: {} })
    .catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(ApiError)
  expect(fixture.target).toEqual([])
  expect(await new SettingsFile().tokensFor(source.url.origin)).toEqual(before)
})

test("同一originでも要求したAPI以外へ追従しない", async () => {
  fixture.mode = "same-origin"
  const failure = await api("/system/work-items").catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(Error)
  expect(fixture.source).toEqual(["GET /system/work-items"])
})

test("直接APIのrefresh後の再送もredirectを追従しない", async () => {
  fixture.mode = "retry"
  const failure = await api("/system/work-items").catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(Error)
  expect(fixture.target).toEqual([])
  expect(fixture.source).toEqual([
    "GET /system/work-items",
    "PATCH /system/sessions",
    "GET /system/work-items",
  ])
})
