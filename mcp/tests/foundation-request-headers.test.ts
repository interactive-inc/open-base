import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const fixture = {
  directory: "",
  expire: false,
  refreshes: 0,
  requests: new Array<{
    method: string
    path: string
    organization: string | null
    revision: string | null
    stepUp: string | null
    idempotency: string | null
    authorization: string | null
    body: unknown
  }>(),
}
const client = new Client({ name: "foundation-header-test", version: "1" })
const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname
    if (path === "/system/sessions" && request.method === "PATCH") {
      fixture.refreshes += 1
      return Response.json({ access_token: "example-fresh", refresh_token: "example-rotated" })
    }
    fixture.requests.push({
      method: request.method,
      path,
      organization: request.headers.get("x-company-organization-id"),
      revision: request.headers.get("if-match"),
      stepUp: request.headers.get("x-system-step-up"),
      idempotency: request.headers.get("idempotency-key"),
      authorization: request.headers.get("authorization"),
      body: request.method === "POST" ? await request.json() : null,
    })
    if (fixture.expire && request.headers.get("authorization") !== "Bearer example-fresh")
      return Response.json({ code: "invalid_session" }, { status: 401 })
    if (path.startsWith("/company/") && request.headers.get("x-company-organization-id") === null)
      return Response.json({ code: "invalid_company_headers" }, { status: 400 })
    if (
      request.method === "POST" &&
      (request.headers.get("if-match") === null || request.headers.get("x-system-step-up") === null)
    )
      return Response.json({ code: "missing_preconditions" }, { status: 400 })
    return Response.json({ ok: true })
  },
})

beforeAll(async () => {
  fixture.directory = await mkdtemp(join(tmpdir(), "base-mcp-headers-"))
  await writeFile(
    join(fixture.directory, "settings.json"),
    JSON.stringify({
      endpoints: {
        [server.url.origin]: { accessToken: "example-access", refreshToken: "example-refresh" },
      },
    }),
  )
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve(import.meta.dir, "../index.ts")],
      env: { ...process.env, BASE_API: server.url.origin, BASE_CONFIG_DIR: fixture.directory },
      stderr: "pipe",
    }),
  )
})
beforeEach(() => {
  fixture.requests.length = 0
  fixture.expire = false
  fixture.refreshes = 0
})
afterAll(async () => {
  await client.close()
  await server.stop(true)
  await rm(fixture.directory, { recursive: true, force: true })
})

test("foundation_requestはCompanyの必須organization headerを送信する", async () => {
  const response = await client.callTool({
    name: "foundation_request",
    arguments: {
      path: "/company/people",
      headers: { "x-company-organization-id": "organization:example" },
    },
  })
  expect(response.isError).not.toBe(true)
  expect(fixture.requests[0]?.organization).toBe("organization:example")
  expect(fixture.requests[0]?.authorization).toBe("Bearer example-access")
})

test("版・再認証・冪等性とJSON bodyを同じ要求へ送信する", async () => {
  const body = { commandId: "example-command", expectedRevision: 7, reason: "Example decision" }
  const response = await client.callTool({
    name: "foundation_request",
    arguments: {
      path: "/company/organization-changes",
      method: "POST",
      body,
      idempotency_key: "example-command",
      headers: {
        "x-company-organization-id": "organization:example",
        "if-match": 'W/"7"',
        "x-system-step-up": "1".repeat(64),
      },
    },
  })
  expect(response.isError).not.toBe(true)
  expect(fixture.requests).toEqual([
    {
      method: "POST",
      path: "/company/organization-changes",
      organization: "organization:example",
      revision: 'W/"7"',
      stepUp: "1".repeat(64),
      idempotency: "example-command",
      authorization: "Bearer example-access",
      body,
    },
  ])
})

test("headerなしの既存System要求も維持する", async () => {
  const response = await client.callTool({
    name: "foundation_request",
    arguments: { path: "/system/health" },
  })
  expect(response.isError).not.toBe(true)
  expect(fixture.requests[0]?.organization).toBeNull()
  expect(fixture.requests[0]?.revision).toBeNull()
  expect(fixture.requests[0]?.stepUp).toBeNull()
})

test("Companyのorganizationを省略しても暗黙に補完しない", async () => {
  const response = await client.callTool({
    name: "foundation_request",
    arguments: { path: "/company/people" },
  })
  expect(response.isError).toBe(true)
  expect(fixture.requests[0]?.organization).toBeNull()
})

for (const headers of [
  { Authorization: "Bearer example-private-value" },
  { Host: "example-private-value" },
  { Cookie: "example-private-value" },
  { "content-type": "example-private-value" },
  { "idempotency-key": "example-private-value" },
  { "x-company-organization-id": "example-private-value\r\nexample" },
  { "if-match": "example-private-value" },
  { "x-system-step-up": "example-private-value" },
]) {
  test(`不正な${Object.keys(headers)[0]}指定は送信せず値を診断へ出さない`, async () => {
    const response = await client.callTool({
      name: "foundation_request",
      arguments: { path: "/system/health", headers },
    })
    expect(response.isError).toBe(true)
    expect(fixture.requests).toEqual([])
    expect(JSON.stringify(response.content)).not.toContain("example-private-value")
  })
}

test("401からの再送でもheader・body・冪等性を保持する", async () => {
  fixture.expire = true
  const body = { commandId: "example-retry", expectedRevision: 3, reason: "Example decision" }
  const response = await client.callTool({
    name: "foundation_request",
    arguments: {
      path: "/company/organization-changes",
      method: "POST",
      body,
      idempotency_key: "example-retry",
      headers: {
        "x-company-organization-id": "organization:example",
        "if-match": '"3"',
        "x-system-step-up": "2".repeat(64),
      },
    },
  })
  expect(response.isError).not.toBe(true)
  expect(fixture.refreshes).toBe(1)
  expect(fixture.requests).toHaveLength(2)
  expect(fixture.requests.map((request) => request.authorization)).toEqual([
    "Bearer example-access",
    "Bearer example-fresh",
  ])
  for (const request of fixture.requests) {
    expect(request.organization).toBe("organization:example")
    expect(request.revision).toBe('"3"')
    expect(request.stepUp).toBe("2".repeat(64))
    expect(request.idempotency).toBe("example-retry")
    expect(request.body).toEqual(body)
  }
})
