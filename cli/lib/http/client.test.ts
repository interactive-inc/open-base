import { afterAll, afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { api } from "@/lib/http/client"
import { ApiError } from "@/lib/errors"
import { SettingsFile } from "@/lib/config/settings-file"

const originalEnvironment = {
  baseApi: process.env.BASE_API,
  configDir: process.env.BASE_CONFIG_DIR,
}
const fixture = { directory: "", body: "", status: 503, refreshes: 0 }
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
    return new Response(fixture.body, { status: fixture.status })
  },
})

afterAll(() => server.stop(true))

beforeEach(async () => {
  fixture.directory = await mkdtemp(join(tmpdir(), "base-client-"))
  fixture.refreshes = 0
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
