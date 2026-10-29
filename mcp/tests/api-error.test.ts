import { expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

for (const scenario of [
  {
    status: 503,
    contentType: "application/json",
    body: "upstream unavailable",
    detail: "upstream unavailable",
  },
  { status: 429, contentType: "application/json", body: "", detail: "" },
  {
    status: 403,
    contentType: "application/json",
    body: '{ "error": "forbidden" }',
    detail: '{"error":"forbidden"}',
  },
  { status: 502, contentType: "text/plain", body: "bad gateway", detail: "bad gateway" },
]) {
  test(`MCP は ${scenario.status} の失敗本文から HTTP status と診断を保持する`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "base-mcp-error-"))
    const requests: string[] = []
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        requests.push(new URL(request.url).pathname)
        return new Response(scenario.body, {
          status: scenario.status,
          headers: { "content-type": scenario.contentType },
        })
      },
    })
    const client = new Client({ name: "api-error-test", version: "1" })
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve(import.meta.dir, "../index.ts")],
      env: { ...process.env, BASE_API: server.url.toString(), BASE_CONFIG_DIR: directory },
      stderr: "pipe",
    })
    try {
      await client.connect(transport)
      const response = await client.callTool({
        name: "foundation_request",
        arguments: { path: "/system/health" },
      })
      expect(response).toMatchObject({
        isError: true,
        content: [{ type: "text", text: `API ${scenario.status}: ${scenario.detail}` }],
      })
      expect(requests).toEqual(["/system/health"])
    } finally {
      await client.close()
      server.stop(true)
      await rm(directory, { recursive: true, force: true })
    }
  }, 15_000)
}
