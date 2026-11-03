import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { createCliTestClient } from "@/tests/support/cli-test-client"

test("CLI sends definition updates and execution filters to their respective API endpoints", async () => {
  const directory = await mkdtemp(join(tmpdir(), "work-execution-cli-"))
  const requests: Array<{ path: string; query: string; body: unknown }> = []
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      requests.push({
        path: url.pathname,
        query: url.search,
        body: request.method === "POST" ? await request.json() : null,
      })
      return Response.json({ data: [] })
    },
  })
  const run = createCliTestClient({
    entry: resolve(import.meta.dir, "../../index.ts"),
    baseUrl: server.url.toString(),
    configDirectory: directory,
  })
  try {
    const file = join(directory, "definition.json")
    const definition = { slug: "example-follow-up", expected_revision: 0 }
    await writeFile(file, JSON.stringify(definition))
    expect((await run(["work-execution", "definitions", "save", "--data", file])).code).toBe(0)
    expect((await run(["work-execution", "runs", "list", "--slug", definition.slug])).code).toBe(0)
    expect(requests).toEqual([
      { path: "/api/work-execution/definitions", query: "", body: definition },
      { path: "/api/work-execution/runs", query: "?slug=example-follow-up", body: null },
    ])
  } finally {
    await server.stop(true)
    await rm(directory, { recursive: true, force: true })
  }
}, 30_000)
