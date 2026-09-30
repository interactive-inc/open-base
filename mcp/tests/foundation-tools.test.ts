import { test, expect } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

test("MCP exposes foundation tools and rejects business paths and traversal", async () => {
  const directory = await mkdtemp(join(tmpdir(), "base-mcp-"))
  const requests: string[] = []
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      requests.push(new URL(request.url).pathname)
      return Response.json({ status: "ok" })
    },
  })
  const client = new Client({ name: "foundation-test", version: "1" })
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(import.meta.dir, "../index.ts")],
    env: { ...process.env, BASE_API: server.url.toString(), BASE_CONFIG_DIR: directory },
    stderr: "pipe",
  })
  try {
    await client.connect(transport)
    const tools = await client.listTools()
    expect(tools.tools.some((tool) => tool.name === "foundation_request")).toBe(true)
    expect(tools.tools.some((tool) => /expense|performance|life_event/.test(tool.name))).toBe(false)
    const result = await client.callTool({
      name: "foundation_request",
      arguments: { path: "/system/health" },
    })
    expect(result.isError).not.toBe(true)
    for (const path of ["/expense/expenses", "/system/../expense", "https://example.com/system"]) {
      const result = await client.callTool({ name: "foundation_request", arguments: { path } })
      expect(result.isError).toBe(true)
    }
    expect(requests).toEqual(["/system/health"])
  } finally {
    await client.close()
    server.stop(true)
    await rm(directory, { recursive: true, force: true })
  }
}, 15_000)
