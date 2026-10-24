import { afterAll, beforeAll, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { apiRequest } from "./api-client"

let directory = ""
let server: ReturnType<typeof Bun.serve> | undefined
const paths: string[] = []

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "base-mcp-"))
  server = Bun.serve({
    port: 0,
    fetch(request) {
      paths.push(new URL(request.url).pathname)
      if (request.headers.get("authorization") !== "Bearer cli-session")
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
      endpoints: { [baseUrl]: { accessToken: "cli-session", refreshToken: "" } },
    }),
  )
})

afterAll(async () => {
  await server?.stop(true)
  await rm(directory, { recursive: true, force: true })
})

test("CLIのログインで保存したセッションtokenで /api を呼ぶ", async () => {
  expect(await apiRequest<{ ok: boolean }>("/employees")).toEqual({ ok: true })
  expect(paths).toEqual(["/api/employees"])
})
