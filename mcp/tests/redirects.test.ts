import { expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

async function fixture(mode: string, status = 307) {
  const directory = await mkdtemp(join(tmpdir(), "base-mcp-redirect-"))
  const targetRequests = new Array<{
    method: string
    authorization: string | null
    stepUp: string | null
    body: string
  }>()
  const sourceRequests = new Array<string>()
  const target = Bun.serve({
    port: 0,
    async fetch(request) {
      targetRequests.push({
        method: request.method,
        authorization: request.headers.get("authorization"),
        stepUp: request.headers.get("x-system-step-up"),
        body: await request.text(),
      })
      return Response.json({
        access_token: "foreign-access",
        refresh_token: "foreign-refresh",
        id: "9bf082a7-b4ee-4505-a5d1-f298be9a0663",
        ok: true,
      })
    },
  })
  const source = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname
      sourceRequests.push(request.method + " " + path)
      if (path === "/outside") return Response.json({ ok: true })
      const location =
        mode === "same-origin"
          ? new URL("/outside", request.url).href
          : new URL("/target", target.url).href
      if (request.method === "PATCH" && path === "/system/sessions") {
        if (mode === "refresh") return new Response(null, { status, headers: { location } })
        return Response.json({ access_token: "fresh-access", refresh_token: "fresh-refresh" })
      }
      if (mode === "refresh" || mode === "retry") {
        if (request.headers.get("authorization") === "Bearer example-access")
          return Response.json({ error: "expired" }, { status: 401 })
        if (mode === "refresh") return Response.json({ ok: true })
      }
      return new Response(null, { status, headers: { location } })
    },
  })
  const settings = join(directory, "settings.json")
  await writeFile(
    settings,
    JSON.stringify({
      endpoints: {
        [source.url.origin]: { accessToken: "example-access", refreshToken: "example-refresh" },
      },
    }),
  )
  const client = new Client({ name: "redirect-test", version: "1" })
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve(import.meta.dir, "../index.ts")],
      env: { ...process.env, BASE_API: source.url.origin, BASE_CONFIG_DIR: directory },
      stderr: "pipe",
    }),
  )
  return {
    client,
    settings,
    directory,
    sourceRequests,
    targetRequests,
    cleanup: async () => {
      await client.close()
      await source.stop(true)
      await target.stop(true)
      await rm(directory, { recursive: true, force: true })
    },
  }
}

test("MCPのAPI要求をredirect先の別originへ転送しない", async () => {
  const f = await fixture("initial")
  try {
    const response = await f.client.callTool({
      name: "foundation_request",
      arguments: {
        path: "/system/work-items",
        method: "POST",
        body: { reason: "example-command" },
        headers: { "x-system-step-up": "1".repeat(64) },
      },
    })
    expect(f.targetRequests).toEqual([])
    expect(response.isError).toBe(true)
  } finally {
    await f.cleanup()
  }
}, 15000)

test("MCPのrefresh tokenをredirect先へ転送しない", async () => {
  const f = await fixture("refresh")
  try {
    const before = await readFile(f.settings, "utf8")
    const response = await f.client.callTool({
      name: "foundation_request",
      arguments: { path: "/system/work-items" },
    })
    expect(f.targetRequests).toEqual([])
    expect(response.isError).toBe(true)
    expect(await readFile(f.settings, "utf8")).toBe(before)
  } finally {
    await f.cleanup()
  }
}, 15000)

for (const status of [301, 302, 303, 308]) {
  test(`MCPは${status}の別originへ転送しない`, async () => {
    const f = await fixture("initial", status)
    try {
      const response = await f.client.callTool({
        name: "foundation_request",
        arguments: {
          path: "/system/work-items",
          method: "POST",
          body: { reason: "example-command" },
        },
      })
      expect(response.isError).toBe(true)
      expect(f.targetRequests).toEqual([])
      expect(f.sourceRequests).toEqual(["POST /system/work-items"])
    } finally {
      await f.cleanup()
    }
  }, 15000)
}

test("MCPのrefresh後の再送もredirectを追従しない", async () => {
  const f = await fixture("retry")
  try {
    const response = await f.client.callTool({
      name: "foundation_request",
      arguments: { path: "/system/work-items" },
    })
    expect(response.isError).toBe(true)
    expect(f.targetRequests).toEqual([])
    expect(f.sourceRequests).toEqual([
      "GET /system/work-items",
      "PATCH /system/sessions",
      "GET /system/work-items",
    ])
    expect(await readFile(f.settings, "utf8")).toContain("fresh-access")
  } finally {
    await f.cleanup()
  }
}, 15000)

test("MCPは同一originでも指定API以外へ追従しない", async () => {
  const f = await fixture("same-origin")
  try {
    const response = await f.client.callTool({
      name: "foundation_request",
      arguments: { path: "/system/work-items" },
    })
    expect(response.isError).toBe(true)
    expect(f.sourceRequests).toEqual(["GET /system/work-items"])
  } finally {
    await f.cleanup()
  }
}, 15000)

test("MCPの添付bodyをredirect先へ転送しない", async () => {
  const f = await fixture("initial")
  try {
    const file = join(f.directory, "example.pdf")
    await writeFile(file, "%PDF-1.4\nexample\n")
    const response = await f.client.callTool({
      name: "attachments_upload",
      arguments: { file_path: file },
    })
    expect(response.isError).toBe(true)
    expect(f.targetRequests).toEqual([])
    expect(f.sourceRequests).toEqual(["POST /system/attachments"])
  } finally {
    await f.cleanup()
  }
}, 15000)
