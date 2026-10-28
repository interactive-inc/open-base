import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { createCliTestClient } from "@/tests/support/cli-test-client"

test("実CLIで評価の経路・冪等キー・commandを送り、不正な入力は送信前に拒否する", async () => {
  const directory = await mkdtemp(join(tmpdir(), "review-cli-"))
  const requests: Array<{ path: string; key: string | null; body: unknown }> = []
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      requests.push({
        path: new URL(request.url).pathname,
        key: request.headers.get("idempotency-key"),
        body: request.method === "GET" ? null : await request.json(),
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
    const id = crypto.randomUUID()
    const key = crypto.randomUUID()
    const file = join(directory, "command.json")
    await writeFile(
      file,
      JSON.stringify({ expected_revision: 2, reason: "確認", target: { task_key: "review" } }),
    )
    expect((await run(["reviews", "sheets", "list", "--scope", "inbox"])).code).toBe(0)
    expect(
      (await run(["reviews", "sheets", "approve", id, "--data", file, "--idempotency-key", key]))
        .code,
    ).toBe(0)
    expect(requests).toMatchObject([
      { path: "/api/performance-review/sheets", key: null },
      {
        path: `/api/performance-review/sheets/${id}/commands`,
        key,
        body: { operation: "decide", action: "approve", expected_revision: 2 },
      },
    ])
    expect((await run(["reviews", "sheets", "approve", id, "--data", file])).code).toBe(1)
    expect((await run(["reviews", "sheets", "show", "bad-id"])).code).toBe(1)
    expect((await run(["reviews", "cycles", "list", "--scope", "all"])).code).toBe(1)
    await writeFile(
      file,
      JSON.stringify({ expected_revision: 2, reason: "確認", operation: "cancel" }),
    )
    expect(
      (await run(["reviews", "sheets", "approve", id, "--data", file, "--idempotency-key", key]))
        .code,
    ).toBe(1)
    expect(requests).toHaveLength(2)
  } finally {
    await server.stop(true)
    await rm(directory, { recursive: true, force: true })
  }
}, 30000)
