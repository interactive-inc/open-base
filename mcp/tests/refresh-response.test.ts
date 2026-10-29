import { expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

async function fixture(body: unknown) {
  const directory = await mkdtemp(join(tmpdir(), "base-refresh-response-"))
  const requests = new Array<string>()
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      requests.push(request.method + " " + new URL(request.url).pathname)
      if (request.method === "PATCH") return Response.json(body)
      if (request.headers.get("authorization") === "Bearer example-fresh")
        return Response.json({ ok: true })
      return Response.json({ error: "expired" }, { status: 401 })
    },
  })
  const settings = join(directory, "settings.json")
  await writeFile(
    settings,
    JSON.stringify({
      endpoints: {
        [server.url.origin]: {
          accessToken: "example-old",
          refreshToken: "example-refresh",
          email: "you@example.com",
          name: "Example",
        },
      },
    }),
  )
  const before = await readFile(settings, "utf8")
  const client = new Client({ name: "refresh-response-test", version: "1" })
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve(import.meta.dir, "../index.ts")],
      env: { ...process.env, BASE_API: server.url.origin, BASE_CONFIG_DIR: directory },
      stderr: "pipe",
    }),
  )
  return {
    client,
    requests,
    settings,
    before,
    baseUrl: server.url.origin,
    cleanup: async () => {
      await client.close()
      await server.stop(true)
      await rm(directory, { recursive: true, force: true })
    },
  }
}

for (const refreshToken of [undefined, "", 0, false, {}, []]) {
  test(`不正なrefresh token応答 ${JSON.stringify(refreshToken)} で保存認証を上書きしない`, async () => {
    const f = await fixture({ access_token: "example-fresh", refresh_token: refreshToken })
    try {
      const response = await f.client.callTool({
        name: "foundation_request",
        arguments: { path: "/system/work-items" },
      })
      expect(await readFile(f.settings, "utf8")).toBe(f.before)
      expect(response.isError).toBe(true)
      expect(f.requests).toEqual(["GET /system/work-items", "PATCH /system/sessions"])
    } finally {
      await f.cleanup()
    }
  }, 15000)
}

for (const refreshToken of [null, "example-rotated"]) {
  test(`正当なrefresh応答 ${JSON.stringify(refreshToken)} は保存して一回再送する`, async () => {
    const f = await fixture({ access_token: "example-fresh", refresh_token: refreshToken })
    try {
      const response = await f.client.callTool({
        name: "foundation_request",
        arguments: { path: "/system/work-items" },
      })
      expect(response.isError).not.toBe(true)
      expect(f.requests).toEqual([
        "GET /system/work-items",
        "PATCH /system/sessions",
        "GET /system/work-items",
      ])
      const stored: unknown = JSON.parse(await readFile(f.settings, "utf8"))
      expect(stored).toEqual({
        endpoints: {
          [f.baseUrl]: {
            accessToken: "example-fresh",
            refreshToken: refreshToken ?? "",
            email: "you@example.com",
            name: "Example",
          },
        },
      })
    } finally {
      await f.cleanup()
    }
  }, 15000)
}

for (const body of [
  null,
  [],
  {},
  { refresh_token: "example-rotated" },
  { access_token: 0, refresh_token: "example-rotated" },
  { access_token: "", refresh_token: "example-rotated" },
]) {
  test(`不正なsession応答 ${JSON.stringify(body)} を保存も再送もしない`, async () => {
    const f = await fixture(body)
    try {
      const response = await f.client.callTool({
        name: "foundation_request",
        arguments: { path: "/system/work-items" },
      })
      expect(await readFile(f.settings, "utf8")).toBe(f.before)
      expect(response.isError).toBe(true)
      expect(f.requests).toEqual(["GET /system/work-items", "PATCH /system/sessions"])
    } finally {
      await f.cleanup()
    }
  }, 15000)
}
