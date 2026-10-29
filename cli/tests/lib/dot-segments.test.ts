import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

for (const args of [
  ["notifications", "delete", ".", "--id", "example-delivery"],
  ["notifications", "show", "..", "delete", "--id", "example-delivery"],
  ["notifications", "delete", "", "--id", "example-delivery"],
  ["notifications", "show", "."],
  ["notifications", "show", ".."],
]) {
  test(`位置引数のURL正規化で別の通知を操作しない: ${JSON.stringify(args)}`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "base-dot-segment-"))
    const requests = new Array<string>()
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        requests.push(request.method + " " + new URL(request.url).pathname)
        return request.method === "DELETE"
          ? new Response(null, { status: 204 })
          : Response.json({ id: "example-delivery" })
      },
    })
    try {
      const command = Bun.spawn(
        [process.execPath, resolve(import.meta.dir, "../../index.ts"), ...args],
        {
          env: { ...process.env, BASE_API: server.url.origin, BASE_CONFIG_DIR: directory },
          stdout: "pipe",
          stderr: "pipe",
        },
      )
      const output = await Promise.all([
        command.exited,
        new Response(command.stdout).text(),
        new Response(command.stderr).text(),
      ])
      expect(requests).toEqual([])
      expect(output[0]).toBe(1)
      expect(output[1]).toBe("")
      expect(output[2]).toContain("位置引数")
      expect(output[2]).not.toContain("example-delivery")
      expect(output[2]).not.toContain("at <anonymous>")
    } finally {
      await server.stop(true)
      await rm(directory, { recursive: true, force: true })
    }
  }, 15000)
}
