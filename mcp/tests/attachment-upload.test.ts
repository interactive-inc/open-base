import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const attachmentId = "9bf082a7-b4ee-4505-a5d1-f298be9a0663"
const fixture: {
  directory: string
  body: unknown
  status: number
  allowLegacy: boolean
  expireAccess: boolean
  refreshes: number
  invalidJson: boolean
  alwaysUnauthorized: boolean
  requests: Array<{
    path: string
    authorization: string | null
    name: string | null
    type: string | null
    content: string | null
  }>
} = {
  directory: "",
  body: null,
  status: 201,
  allowLegacy: false,
  expireAccess: false,
  refreshes: 0,
  invalidJson: false,
  alwaysUnauthorized: false,
  requests: [],
}
const client = new Client({ name: "attachment-test", version: "1" })
const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname
    if (request.method === "PATCH" && path === "/system/sessions") {
      fixture.refreshes += 1
      return Response.json({ access_token: "example-fresh", refresh_token: "example-rotated" })
    }
    const form = await request.formData()
    const file = form.get("file")
    fixture.requests.push({
      path,
      authorization: request.headers.get("authorization"),
      name: file instanceof File ? file.name : null,
      type: file instanceof File ? file.type : null,
      content: file instanceof File ? await file.text() : null,
    })
    if (path !== "/system/attachments" && !fixture.allowLegacy)
      return Response.json({ error: "not found" }, { status: 404 })
    if (
      fixture.alwaysUnauthorized ||
      (fixture.expireAccess && request.headers.get("authorization") !== "Bearer example-fresh")
    )
      return Response.json({ error: "expired" }, { status: 401 })
    if (fixture.invalidJson)
      return new Response("example-private-value: invalid JSON", { status: 201 })
    return Response.json(fixture.body, { status: fixture.status })
  },
})

beforeAll(async () => {
  fixture.directory = await mkdtemp(join(tmpdir(), "base-mcp-upload-"))
  await writeFile(join(fixture.directory, "example.pdf"), "%PDF-1.7\nexample\n")
  const baseUrl = `http://127.0.0.1:${server.port}`
  await writeFile(
    join(fixture.directory, "settings.json"),
    JSON.stringify({
      endpoints: {
        [baseUrl]: { accessToken: "example-access", refreshToken: "example-refresh" },
      },
    }),
  )
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve(import.meta.dir, "../index.ts")],
      env: { ...process.env, BASE_API: baseUrl, BASE_CONFIG_DIR: fixture.directory },
      stderr: "pipe",
    }),
  )
})

beforeEach(() => {
  fixture.body = { id: attachmentId }
  fixture.status = 201
  fixture.allowLegacy = false
  fixture.expireAccess = false
  fixture.refreshes = 0
  fixture.invalidJson = false
  fixture.alwaysUnauthorized = false
  fixture.requests.length = 0
})

afterAll(async () => {
  await client.close()
  await server.stop(true)
  await rm(fixture.directory, { recursive: true, force: true })
})

test("uploads authenticated multipart to the current System endpoint", async () => {
  const uploaded = await client.callTool({
    name: "attachments_upload",
    arguments: {
      file_path: join(fixture.directory, "example.pdf"),
    },
  })

  expect(uploaded.isError).not.toBe(true)
  expect(uploaded.content).toEqual([
    { type: "text", text: JSON.stringify({ attachment_id: attachmentId }) },
  ])
  expect(fixture.requests).toEqual([
    {
      path: "/system/attachments",
      authorization: "Bearer example-access",
      name: "example.pdf",
      type: "application/pdf",
      content: "%PDF-1.7\nexample\n",
    },
  ])
})

test.each([null, {}, { id: null }, { id: 17 }, { id: {} }, { id: "" }, { id: "   " }])(
  "rejects invalid attachment metadata: %j",
  async (body) => {
    fixture.allowLegacy = true
    fixture.body = body

    const uploaded = await client.callTool({
      name: "attachments_upload",
      arguments: {
        file_path: join(fixture.directory, "example.pdf"),
      },
    })

    expect(uploaded.isError).toBe(true)
    expect(JSON.stringify(uploaded)).not.toContain("[object Object]")
  },
)

test("preserves the upload failure when the API rejects it", async () => {
  fixture.status = 503
  fixture.allowLegacy = true
  const uploaded = await client.callTool({
    name: "attachments_upload",
    arguments: {
      file_path: join(fixture.directory, "example.pdf"),
    },
  })

  expect(uploaded.isError).toBe(true)
  expect(uploaded.content).toEqual([
    { type: "text", text: "添付のアップロードに失敗しました (503)" },
  ])
  expect(fixture.requests).toHaveLength(1)
  expect(fixture.refreshes).toBe(0)
})

test("invalid JSON is rejected without reflecting its contents", async () => {
  fixture.invalidJson = true
  const uploaded = await client.callTool({
    name: "attachments_upload",
    arguments: {
      file_path: join(fixture.directory, "example.pdf"),
    },
  })

  expect(uploaded.isError).toBe(true)
  expect(JSON.stringify(uploaded)).not.toContain("example-private-value")
  expect(fixture.requests).toHaveLength(1)
})

test("an expired access token is refreshed once and the same file is retried", async () => {
  fixture.expireAccess = true
  const uploaded = await client.callTool({
    name: "attachments_upload",
    arguments: {
      file_path: join(fixture.directory, "example.pdf"),
    },
  })

  expect(uploaded.isError).not.toBe(true)
  expect(fixture.refreshes).toBe(1)
  expect(fixture.requests.map((request) => request.authorization)).toEqual([
    "Bearer example-access",
    "Bearer example-fresh",
  ])
  expect(fixture.requests.map((request) => request.content)).toEqual([
    "%PDF-1.7\nexample\n",
    "%PDF-1.7\nexample\n",
  ])
  const saved = JSON.parse(await readFile(join(fixture.directory, "settings.json"), "utf8"))
  expect(saved.endpoints[`http://127.0.0.1:${server.port}`].refreshToken).toBe("example-rotated")
})

test("a rejected authenticated retry stops after one rotation", async () => {
  fixture.alwaysUnauthorized = true
  const uploaded = await client.callTool({
    name: "attachments_upload",
    arguments: {
      file_path: join(fixture.directory, "example.pdf"),
    },
  })

  expect(uploaded.isError).toBe(true)
  expect(fixture.requests).toHaveLength(2)
  expect(fixture.refreshes).toBe(1)
})
