import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const fixture = {
  directory: "",
  requests: new Array<{
    path: string
    query: string
    organization: string | null
    authorization: string | null
  }>(),
}
const client = new Client({ name: "foundation-path-test", version: "1" })
const server = Bun.serve({
  port: 0,
  fetch(request) {
    const url = new URL(request.url)
    fixture.requests.push({
      path: url.pathname,
      query: url.search,
      organization: request.headers.get("x-company-organization-id"),
      authorization: request.headers.get("authorization"),
    })
    return Response.json({ id: decodeURIComponent(url.pathname.split("/").at(-1) ?? "") })
  },
})

beforeAll(async () => {
  fixture.directory = await mkdtemp(join(tmpdir(), "base-mcp-paths-"))
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
})
afterAll(async () => {
  await client.close()
  await server.stop(true)
  await rm(fixture.directory, { recursive: true, force: true })
})

for (const path of [
  "/company/resource-history/person/person:example",
  "/company/resource-history/person/person%3Aexample",
]) {
  test(`Companyの資源IDを単一segmentで送信する: ${path}`, async () => {
    const response = await client.callTool({
      name: "foundation_request",
      arguments: { path, headers: { "x-company-organization-id": "organization:example" } },
    })
    expect(response.isError).not.toBe(true)
    expect(response.content).toEqual([
      { type: "text", text: JSON.stringify({ id: "person:example" }, null, 2) },
    ])
    expect(fixture.requests).toEqual([
      {
        path: "/company/resource-history/person/person%3Aexample",
        query: "",
        organization: "organization:example",
        authorization: "Bearer example-access",
      },
    ])
  })
}

for (const scenario of [
  { segment: "人物", canonical: "%E4%BA%BA%E7%89%A9", id: "人物" },
  { segment: "%E4%BA%BA%E7%89%A9", canonical: "%E4%BA%BA%E7%89%A9", id: "人物" },
  { segment: "folder%2Fitem", canonical: "folder%2Fitem", id: "folder/item" },
  { segment: "folder%5Citem", canonical: "folder%5Citem", id: "folder\\item" },
  { segment: "id%3Fquery%23fragment", canonical: "id%3Fquery%23fragment", id: "id?query#fragment" },
  { segment: "id%25percent", canonical: "id%25percent", id: "id%percent" },
  { segment: "%252e%252e", canonical: "%252e%252e", id: "%2e%2e" },
]) {
  test(`URIを一度だけ解釈してIDを保持する: ${scenario.segment}`, async () => {
    const response = await client.callTool({
      name: "foundation_request",
      arguments: {
        path: `/company/resource-history/person/${scenario.segment}`,
        headers: { "x-company-organization-id": "organization:example" },
        query: { limit: 1, after_revision: 0 },
      },
    })
    expect(response.isError).not.toBe(true)
    expect(response.content).toEqual([
      { type: "text", text: JSON.stringify({ id: scenario.id }, null, 2) },
    ])
    expect(fixture.requests).toEqual([
      {
        path: `/company/resource-history/person/${scenario.canonical}`,
        query: "?limit=1&after_revision=0",
        organization: "organization:example",
        authorization: "Bearer example-access",
      },
    ])
  })
}

for (const path of [
  "https://example.com/system/health",
  "//example.com/system/health",
  "/other/health",
  "/systematic/health",
  "/%73ystem/health",
  "/system//health",
  "/system/.",
  "/system/..",
  "/system/../other",
  "/system/%2e%2e/other",
  "/system/.%2E/other",
  "/company/people/%2E.",
  "/system/health?example=1",
  "/system/health#example",
  "/system\\..\\other",
  "/system/health\nexample",
  "/system/%",
  "/system/%zz",
  "/system/%FF",
]) {
  test(`不正なpathをHTTPへ送らない: ${JSON.stringify(path)}`, async () => {
    const response = await client.callTool({ name: "foundation_request", arguments: { path } })
    expect(response.isError).toBe(true)
    expect(fixture.requests).toEqual([])
  })
}
