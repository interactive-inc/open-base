import { afterAll, afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SettingsFile } from "@/lib/config/settings-file"
import { uploadAttachment } from "@/lib/http/upload-attachment"
import { UsageError } from "@/lib/errors"

const previous = { directory: process.env.BASE_CONFIG_DIR, api: process.env.BASE_API }
const fixture = {
  directory: "",
  expired: false,
  refreshes: 0,
  status: 201,
  content: new Array<string>(),
}
const id = "9bf082a7-b4ee-4505-a5d1-f298be9a0663"
const server = Bun.serve({
  port: 0,
  async fetch(request) {
    if (request.method === "PATCH") {
      fixture.refreshes += 1
      return Response.json({ access_token: "example-fresh", refresh_token: "example-rotated" })
    }
    const file = (await request.formData()).get("file")
    if (file instanceof File) fixture.content.push(await file.text())
    if (new URL(request.url).pathname !== "/system/attachments")
      return new Response(null, { status: 404 })
    if (fixture.status !== 201) return new Response(null, { status: fixture.status })
    if (fixture.expired && request.headers.get("authorization") !== "Bearer example-fresh")
      return new Response(null, { status: 401 })
    return Response.json({ id }, { status: 201 })
  },
})

beforeEach(async () => {
  fixture.directory = await mkdtemp(join(tmpdir(), "base-cli-upload-"))
  fixture.expired = false
  fixture.status = 201
  fixture.refreshes = 0
  fixture.content.length = 0
  process.env.BASE_CONFIG_DIR = fixture.directory
  process.env.BASE_API = "http://127.0.0.1:1"
  await writeFile(join(fixture.directory, "example.pdf"), "%PDF-1.7\nexample\n")
  await new SettingsFile().saveTokens(`http://127.0.0.1:${server.port}`, {
    token: "example-access",
    refresh_token: "example-refresh",
  })
})

afterEach(async () => {
  if (previous.directory === undefined) delete process.env.BASE_CONFIG_DIR
  else process.env.BASE_CONFIG_DIR = previous.directory
  if (previous.api === undefined) delete process.env.BASE_API
  else process.env.BASE_API = previous.api
  await rm(fixture.directory, { recursive: true, force: true })
})
afterAll(() => server.stop(true))

test("upload uses its explicit endpoint and preserves the file", async () => {
  expect(
    await uploadAttachment(
      join(fixture.directory, "example.pdf"),
      `http://127.0.0.1:${server.port}`,
    ),
  ).toBe(id)
  expect(fixture.content).toEqual(["%PDF-1.7\nexample\n"])
})

test("upload rotates an expired session at the explicit endpoint and retries once", async () => {
  fixture.expired = true

  expect(
    await uploadAttachment(
      join(fixture.directory, "example.pdf"),
      `http://127.0.0.1:${server.port}`,
    ),
  ).toBe(id)
  expect(fixture.refreshes).toBe(1)
  expect(fixture.content).toEqual(["%PDF-1.7\nexample\n", "%PDF-1.7\nexample\n"])
  expect(await new SettingsFile().tokensFor(`http://127.0.0.1:${server.port}`)).toEqual({
    token: "example-fresh",
    refresh_token: "example-rotated",
  })
})

test.each([503, 401])(
  "upload preserves its HTTP %s failure without repeated retries",
  async (status) => {
    fixture.status = status

    const failure = await uploadAttachment(
      join(fixture.directory, "example.pdf"),
      `http://127.0.0.1:${server.port}`,
    ).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(UsageError)
    if (!(failure instanceof UsageError)) throw new Error("expected UsageError")
    expect(failure.message).toBe(`添付のアップロードに失敗しました (${status})`)
    expect(fixture.refreshes).toBe(status === 401 ? 1 : 0)
    expect(fixture.content).toHaveLength(status === 401 ? 2 : 1)
  },
)
