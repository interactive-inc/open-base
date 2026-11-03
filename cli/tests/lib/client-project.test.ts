import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { createCliTestClient } from "@/tests/support/cli-test-client"

test("CLI lists independent catalogs and sends project revisions with an idempotency key", async () => {
  const directory = await mkdtemp(join(tmpdir(), "base-client-project-"))
  const requests: Array<{ path: string; key: string | null; body: unknown }> = []
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      requests.push({
        path: new URL(request.url).pathname,
        key: request.headers.get("idempotency-key"),
        body: request.method === "POST" ? await request.json() : null,
      })
      return Response.json({ status: "ok" })
    },
  })
  const run = createCliTestClient({
    entry: resolve(import.meta.dir, "../../index.ts"),
    baseUrl: server.url.toString(),
    configDirectory: directory,
  })
  try {
    const key = crypto.randomUUID()
    const file = join(directory, "record.json")
    const record = {
      kind: "effort",
      id: crypto.randomUUID(),
      project_id: crypto.randomUUID(),
      expected_revision: 0,
      minutes: 30,
      worked_on: "2026-11-04",
      status: "recorded",
      reason: "Record work",
    }
    await writeFile(file, JSON.stringify(record))
    expect((await run(["customer", "list", "--search", "Example"])).code).toBe(0)
    expect((await run(["offering", "list"])).code).toBe(0)
    expect((await run(["client-project", "list", "project"])).code).toBe(0)
    expect(
      (await run(["client-project", "save", "--data", file, "--idempotency-key", key])).code,
    ).toBe(0)
    const customer = {
      id: crypto.randomUUID(),
      expected_revision: 0,
      name: "Example Customer",
      status: "active",
      reason: "Register",
    }
    const offering = {
      ...customer,
      id: crypto.randomUUID(),
      name: "Example Service",
      code: "SERVICE",
      type: "service",
    }
    for (const [catalog, body] of [
      ["customer", customer],
      ["offering", offering],
    ] as const) {
      await writeFile(file, JSON.stringify(body))
      expect((await run([catalog, "save", "--data", file, "--idempotency-key", key])).code).toBe(0)
    }
    expect(requests).toEqual([
      { path: "/api/customer/records", key: null, body: null },
      { path: "/api/offering/records", key: null, body: null },
      { path: "/api/client-project/records", key: null, body: null },
      { path: "/api/client-project/records", key, body: record },
      { path: "/api/customer/records", key, body: customer },
      { path: "/api/offering/records", key, body: offering },
    ])
  } finally {
    await server.stop(true)
    await rm(directory, { recursive: true, force: true })
  }
}, 30_000)
