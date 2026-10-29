import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

for (const isAccepted of [false, true]) {
  test(`login uses only the submitted credentials (accepted=${isAccepted})`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "base-login-"))
    const requests: { method: string; path: string; authorization: string | null }[] = []
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const path = new URL(request.url).pathname
        requests.push({
          method: request.method,
          path,
          authorization: request.headers.get("authorization"),
        })
        if (request.method === "PATCH")
          return Response.json({ access_token: "rotated-access", refresh_token: "rotated-refresh" })
        if (request.method === "POST") {
          if (!isAccepted) return Response.json({ error: "invalid_credentials" }, { status: 401 })
          return Response.json({ access_token: "new-access", refresh_token: "new-refresh" })
        }
        return Response.json({ name: "New account" })
      },
    })
    const baseUrl = server.url.toString().replace(/\/$/, "")
    const settingsFile = join(directory, "settings.json")
    const initial = JSON.stringify({
      endpoints: {
        [baseUrl]: {
          accessToken: "saved-access",
          refreshToken: "saved-refresh",
          email: "saved@example.com",
          name: "Saved account",
        },
      },
    })
    await writeFile(settingsFile, initial)
    try {
      const command = Bun.spawn(
        [
          process.execPath,
          resolve(import.meta.dir, "../../index.ts"),
          "login",
          "--email",
          "you@example.com",
          "--password",
          "example-password",
        ],
        {
          env: { ...process.env, BASE_API: baseUrl, BASE_CONFIG_DIR: directory },
          stdout: "pipe",
          stderr: "pipe",
        },
      )
      const output = await Promise.all([
        command.exited,
        new Response(command.stdout).text(),
        new Response(command.stderr).text(),
      ])
      expect(output[0]).toBe(isAccepted ? 0 : 1)
      const loginRequest = { method: "POST", path: "/system/sessions", authorization: null }
      if (!isAccepted) {
        expect(requests).toEqual([loginRequest])
        expect(output[2]).toContain("ERR 401")
        expect(await readFile(settingsFile, "utf8")).toBe(initial)
        return
      }
      expect(requests).toEqual([
        loginRequest,
        { method: "GET", path: "/company/current-profile", authorization: "Bearer new-access" },
      ])
      expect(output[1]).toContain("ログイン成功")
      expect(JSON.parse(await readFile(settingsFile, "utf8"))).toEqual({
        endpoints: {
          [baseUrl]: {
            accessToken: "new-access",
            refreshToken: "new-refresh",
            email: "you@example.com",
            name: "New account",
          },
        },
      })
    } finally {
      server.stop(true)
      await rm(directory, { recursive: true, force: true })
    }
  }, 15_000)
}
