import { afterAll, beforeAll, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { apiRequest } from "./api-client"

let directory = ""
let server: ReturnType<typeof Bun.serve> | undefined
const presented: string[] = []

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "base-mcp-"))
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === "/system/sessions" && request.method === "PATCH") {
        const body = (await request.json()) as { refresh_token: string }
        presented.push(body.refresh_token)
        return Response.json({ access_token: "fresh-access", refresh_token: "rotated-refresh" })
      }
      if (request.headers.get("authorization") !== "Bearer fresh-access")
        return Response.json({ error: "unauthorized" }, { status: 401 })
      return Response.json({ ok: true })
    },
  })
  const baseUrl = `http://127.0.0.1:${server.port}`
  process.env.BASE_API = baseUrl
  process.env.BASE_CONFIG_DIR = directory
  await writeFile(
    join(directory, "settings.json"),
    JSON.stringify({
      endpoints: { [baseUrl]: { accessToken: "expired-access", refreshToken: "first-refresh" } },
    }),
  )
})

afterAll(async () => {
  await server?.stop(true)
  await rm(directory, { recursive: true, force: true })
})

test("401で更新したら、入れ替わった refresh token を保存して次の更新に使う", async () => {
  expect(await apiRequest<{ ok: boolean }>("/employees")).toEqual({ ok: true })
  expect(presented).toEqual(["first-refresh"])
  const saved = JSON.parse(await readFile(join(directory, "settings.json"), "utf8"))
  expect(saved.endpoints[`http://127.0.0.1:${server?.port}`]).toMatchObject({
    accessToken: "fresh-access",
    refreshToken: "rotated-refresh",
  })
})
