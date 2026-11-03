import { test, expect } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

test("MCP exposes foundation tools and rejects business paths and traversal", async () => {
  const directory = await mkdtemp(join(tmpdir(), "base-mcp-"))
  const requests: string[] = []
  const writes: Array<{ key: string | null; body: unknown }> = []
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      requests.push(new URL(request.url).pathname)
      if (request.method === "POST")
        writes.push({ key: request.headers.get("idempotency-key"), body: await request.json() })
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
    expect(tools.tools.some((tool) => /expense|life_event/.test(tool.name))).toBe(false)
    const result = await client.callTool({
      name: "foundation_request",
      arguments: { path: "/system/health" },
    })
    expect(result.isError).not.toBe(true)
    for (const path of ["/expense/expenses", "/system/../expense", "https://example.com/system"]) {
      const result = await client.callTool({ name: "foundation_request", arguments: { path } })
      expect(result.isError).toBe(true)
    }
    expect(requests).toEqual(["/api/system/health"])
    const id = crypto.randomUUID()
    const key = crypto.randomUUID()
    for (const name of ["customer_records", "offering_records", "client_project_records"]) {
      const result = await client.callTool({
        name,
        arguments:
          name === "client_project_records"
            ? { kind: "project", customer_id: id }
            : { search: "Example" },
      })
      expect(result.isError).not.toBe(true)
    }
    const saved = await client.callTool({
      name: "customer_save",
      arguments: {
        idempotency_key: key,
        record: { id, expected_revision: 0, name: "Example", status: "active", reason: "Register" },
      },
    })
    expect(saved.isError).not.toBe(true)
    const offering = {
      id: crypto.randomUUID(),
      expected_revision: 0,
      name: "Example service",
      code: "SVC",
      type: "service",
      status: "active",
      reason: "Register",
    }
    const effort = {
      id: crypto.randomUUID(),
      expected_revision: 0,
      kind: "effort",
      project_id: crypto.randomUUID(),
      worked_on: "2026-11-04",
      minutes: 60,
      status: "recorded",
      reason: "Record work",
    }
    for (const [name, record] of [
      ["offering_save", offering],
      ["client_project_save", effort],
    ] as const) {
      const result = await client.callTool({ name, arguments: { idempotency_key: key, record } })
      expect(result.isError).not.toBe(true)
    }
    expect(requests.slice(1)).toEqual([
      "/api/customer/records",
      "/api/offering/records",
      "/api/client-project/records",
      "/api/customer/records",
      "/api/offering/records",
      "/api/client-project/records",
    ])
    expect(writes).toMatchObject([
      { key, body: { id, expected_revision: 0 } },
      { key, body: offering },
      { key, body: effort },
    ])
    const definitions = await client.callTool({
      name: "work_execution_definitions",
      arguments: { slug: "example-follow-up", revision: 1 },
    })
    expect(definitions.isError).not.toBe(true)
    const executions = await client.callTool({
      name: "work_execution_runs",
      arguments: { slug: "example-follow-up", tag: "customer" },
    })
    expect(executions.isError).not.toBe(true)
    const report = await client.callTool({
      name: "work_execution_record",
      arguments: {
        execution: {
          id: crypto.randomUUID(),
          slug: "example-follow-up",
          definition_revision: 1,
          started_at: "2026-11-04T00:00:00.000Z",
          finished_at: "2026-11-04T00:01:00.000Z",
          outcome: "succeeded",
          summary: "Completed",
          ai_assisted: true,
          trigger: "scheduled",
        },
      },
    })
    expect(report.isError).not.toBe(true)
    expect(requests.slice(-3)).toEqual([
      "/api/work-execution/definitions",
      "/api/work-execution/runs",
      "/api/work-execution/runs",
    ])
  } finally {
    await client.close()
    server.stop(true)
    await rm(directory, { recursive: true, force: true })
  }
}, 15_000)
