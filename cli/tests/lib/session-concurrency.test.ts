import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

test.each(["api", "hc"])(
  "MCP and CLI %s share one rotation across processes",
  async (client) => {
    const directory = await mkdtemp(join(tmpdir(), "base-auth-processes-"))
    const observations = { rotations: 0, revoked: false }
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        if (request.method === "PATCH") {
          observations.rotations += 1
          if (observations.rotations > 1) observations.revoked = true
          await Bun.sleep(20)
          return Response.json({
            access_token: "example-fresh",
            refresh_token: "example-successor",
          })
        }
        if (
          !observations.revoked &&
          request.headers.get("authorization") === "Bearer example-fresh"
        )
          return Response.json({ ok: true })
        await Bun.sleep(10)
        return Response.json({ error: "expired" }, { status: 401 })
      },
    })
    const baseUrl = `http://127.0.0.1:${server.port}`
    const initial = {
      version: 1,
      endpoints: {
        [baseUrl]: {
          accessToken: "example-expired",
          refreshToken: "example-refresh",
          email: "you@example.com",
          name: "Example User",
        },
        "https://other.example.com": { custom: "preserve" },
      },
    }
    await writeFile(join(directory, "settings.json"), JSON.stringify(initial))
    const source =
      client === "api"
        ? 'import {api} from "./lib/http/client"; console.log(JSON.stringify(await api("/system/work-items")));'
        : 'import {createClient} from "./lib/http/hc-client"; console.log(JSON.stringify(await (await (await createClient()).system["work-items"].$get({query:{}})).json()));'
    const root = new URL("../../../", import.meta.url).pathname
    const commands = [
      { cwd: join(root, "cli"), source },
      {
        cwd: join(root, "mcp"),
        source:
          'import {apiRequest} from "./lib/api-client"; console.log(JSON.stringify(await apiRequest("/system/work-items")));',
      },
    ]
    const children = commands.map((command) =>
      Bun.spawn([process.execPath, "--eval", command.source], {
        cwd: command.cwd,
        env: { ...process.env, BASE_API: baseUrl, BASE_CONFIG_DIR: directory },
        stdout: "pipe",
        stderr: "pipe",
      }),
    )

    try {
      const outputs = await Promise.all(children.map((child) => new Response(child.stdout).text()))
      expect(await Promise.all(children.map((child) => child.exited))).toEqual([0, 0])
      expect(outputs.map((output) => JSON.parse(output))).toEqual([{ ok: true }, { ok: true }])
      expect(observations).toEqual({ rotations: 1, revoked: false })
      const saved = JSON.parse(await readFile(join(directory, "settings.json"), "utf8"))
      expect(saved.version).toBe(1)
      expect(saved.endpoints[baseUrl]).toEqual({
        accessToken: "example-fresh",
        refreshToken: "example-successor",
        email: "you@example.com",
        name: "Example User",
      })
      expect(saved.endpoints["https://other.example.com"]).toEqual({ custom: "preserve" })
    } finally {
      for (const child of children) child.kill()
      await Promise.all(children.map((child) => child.exited))
      await server.stop(true)
      await rm(directory, { recursive: true, force: true })
    }
  },
  10_000,
)
