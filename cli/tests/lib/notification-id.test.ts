import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

for (const scenario of [
  { operation: "show", ids: ["example-delivery"], method: "GET" },
  { operation: "delete", ids: ["example-delivery"], method: "DELETE" },
  { operation: "show", ids: ["--id", "example-delivery"], method: "GET" },
  { operation: "delete", ids: ["--id", "example-delivery"], method: "DELETE" },
  { operation: "show", ids: ["example-delivery", "--id", "example-delivery"], method: "GET" },
  { operation: "delete", ids: ["example-delivery", "--id", "different-delivery"], method: null },
  { operation: "delete", ids: [], method: null },
]) {
  test(`notification ${scenario.operation} resolves ${scenario.ids.join(" ") || "a missing ID"}`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "base-notification-id-"))
    const requests: string[] = []
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        requests.push(request.method + " " + new URL(request.url).pathname)
        if (request.method === "DELETE") return new Response(null, { status: 204 })
        return Response.json({ id: "example-delivery", title: "Example notification" })
      },
    })
    try {
      const command = Bun.spawn(
        [
          process.execPath,
          resolve(import.meta.dir, "../../index.ts"),
          "notifications",
          scenario.operation,
          ...scenario.ids,
        ],
        {
          env: { ...process.env, BASE_API: server.url.toString(), BASE_CONFIG_DIR: directory },
          stdout: "pipe",
          stderr: "pipe",
        },
      )
      const output = await Promise.all([
        command.exited,
        new Response(command.stdout).text(),
        new Response(command.stderr).text(),
      ])
      if (scenario.method === null) {
        expect(output[0]).toBe(1)
        expect(requests).toEqual([])
        return
      }
      expect(requests).toEqual([scenario.method + " /system/notifications/example-delivery"])
      expect(output[0]).toBe(0)
      expect(JSON.parse(output[1])).toMatchObject({ id: "example-delivery" })
    } finally {
      await server.stop(true)
      await rm(directory, { recursive: true, force: true })
    }
  }, 15_000)
}
