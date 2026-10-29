import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

for (const args of [
  ["notifications", "send", "--to", "E001", "--title"],
  ["notifications", "send", "--to", "--title", "Example"],
  ["login", "--email", "you@example.com", "--password"],
]) {
  test(`missing option values stop before API access: ${args.at(-1)}`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "base-flag-"))
    const requests: string[] = []
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        requests.push(request.method + " " + new URL(request.url).pathname)
        return Response.json({ id: "example", access_token: "example-access", refresh_token: null })
      },
    })
    try {
      const command = Bun.spawn(
        [process.execPath, resolve(import.meta.dir, "../../index.ts"), ...args],
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
      expect(requests).toEqual([])
      expect(output[0]).toBe(1)
      expect(output[1]).toBe("")
      expect(output[2]).toContain("値が必要です")
      expect(output[2]).not.toContain("at <anonymous>")
      expect(await Bun.file(join(directory, "settings.json")).exists()).toBe(false)
    } finally {
      server.stop(true)
      await rm(directory, { recursive: true, force: true })
    }
  }, 15_000)
}
