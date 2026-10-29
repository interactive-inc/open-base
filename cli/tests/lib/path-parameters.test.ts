import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

for (const isPositional of [false, true]) {
  test(`notification deletion keeps an untrusted ID inside its intended path segment (positional=${isPositional})`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "base-path-"))
    const requests: string[] = []
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        requests.push(request.method + " " + new URL(request.url).pathname)
        return new Response(null, { status: 204 })
      },
    })
    const id = "../../company/approval-delegations/example"
    try {
      const command = Bun.spawn(
        [
          process.execPath,
          resolve(import.meta.dir, "../../index.ts"),
          "notifications",
          "delete",
          ...(isPositional ? [id] : ["--id", id]),
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
      expect(output[0]).toBe(0)
      expect(requests).toEqual(["DELETE /system/notifications/" + encodeURIComponent(id)])
    } finally {
      await server.stop(true)
      await rm(directory, { recursive: true, force: true })
    }
  }, 15_000)
}
