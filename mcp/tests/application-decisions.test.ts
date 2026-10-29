import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const decisionTarget = {
  proposal_version: 3,
  proposal_digest: "a".repeat(64),
  task_key: "review-task",
  task_round: 2,
}
const fixture = {
  directory: "",
  status: 200,
  reads: 0,
  requests: new Array<{ path: string; body: unknown }>(),
}
const client = new Client({ name: "application-decision-test", version: "1" })
const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname
    if (request.method === "GET") {
      fixture.reads += 1
      return Response.json({ decision_target: decisionTarget })
    }
    const body: unknown = await request.json()
    fixture.requests.push({ path, body })
    if (
      typeof body !== "object" ||
      body === null ||
      !("decision_target" in body) ||
      JSON.stringify(body.decision_target) !== JSON.stringify(decisionTarget)
    )
      return Response.json({ code: "invalid_decision_target" }, { status: 400 })
    if (fixture.status === 409)
      return Response.json({ code: "decision_target_conflict" }, { status: 409 })
    return Response.json({ status: "example-decided" })
  },
})
beforeAll(async () => {
  fixture.directory = await mkdtemp(join(tmpdir(), "base-mcp-decisions-"))
  await writeFile(
    join(fixture.directory, "settings.json"),
    JSON.stringify({ endpoints: { [server.url.origin]: { accessToken: "example-access" } } }),
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
  fixture.reads = 0
  fixture.status = 200
})
afterAll(async () => {
  await client.close()
  await server.stop(true)
  await rm(fixture.directory, { recursive: true, force: true })
})

for (const action of ["approve", "reject"]) {
  test(`${action}はshowで確認したdecision_targetをそのまま送信する`, async () => {
    const shown = await client.callTool({
      name: "application_requests_show",
      arguments: { application_id: "42" },
    })
    expect(shown.isError).not.toBe(true)
    expect(shown.content).toEqual([
      { type: "text", text: JSON.stringify({ decision_target: decisionTarget }, null, 2) },
    ])
    const decided = await client.callTool({
      name: `application_requests_${action}`,
      arguments: {
        application_id: "42",
        decision_target: decisionTarget,
        comment: "Example reason",
      },
    })
    expect(decided.isError).not.toBe(true)
    expect(fixture.reads).toBe(1)
    expect(fixture.requests).toEqual([
      {
        path: `/company/application-requests/42/${action}`,
        body: { decision_target: decisionTarget, comment: "Example reason" },
      },
    ])
  })
  test(`${action}は対象競合を自動補完・再試行しない`, async () => {
    fixture.status = 409
    const conflicted = await client.callTool({
      name: `application_requests_${action}`,
      arguments: {
        application_id: "42",
        decision_target: decisionTarget,
        comment: "Example reason",
      },
    })
    expect(conflicted.isError).toBe(true)
    expect(JSON.stringify(conflicted.content)).toContain("409")
    expect(fixture.requests).toHaveLength(1)
    expect(fixture.reads).toBe(0)
  })
  for (const invalid of [
    undefined,
    {},
    { ...decisionTarget, proposal_version: 0 },
    { ...decisionTarget, proposal_version: Number.MAX_SAFE_INTEGER + 1 },
    { ...decisionTarget, proposal_digest: "invalid" },
    { ...decisionTarget, task_key: "" },
    { ...decisionTarget, task_round: 0 },
    { ...decisionTarget, task_round: Number.MAX_SAFE_INTEGER + 1 },
    { ...decisionTarget, extra: true },
  ]) {
    test(`${action}は不正なdecision_targetをHTTP送信前に拒否する: ${JSON.stringify(invalid)}`, async () => {
      const rejected = await client.callTool({
        name: `application_requests_${action}`,
        arguments: { application_id: "42", decision_target: invalid, comment: "Example reason" },
      })
      expect(rejected.isError).toBe(true)
      expect(fixture.requests).toEqual([])
    })
  }
}

test("公開tool schemaに判断対象を必須として示す", async () => {
  const catalogue = await client.listTools()
  for (const action of ["approve", "reject"]) {
    expect(
      catalogue.tools.find((tool) => tool.name === `application_requests_${action}`),
    ).toMatchObject({
      inputSchema: { required: expect.arrayContaining(["decision_target"]) },
    })
  }
})

test("approveはcommentなしでも明示した対象を送れる", async () => {
  const approved = await client.callTool({
    name: "application_requests_approve",
    arguments: { application_id: "42", decision_target: decisionTarget },
  })
  expect(approved.isError).not.toBe(true)
  expect(fixture.requests[0]?.body).toEqual({ decision_target: decisionTarget, comment: null })
})

for (const invalid of [
  { action: "approve", comment: "x".repeat(3001) },
  { action: "reject", comment: undefined },
  { action: "reject", comment: "" },
  { action: "reject", comment: "x".repeat(3001) },
]) {
  test(`不正なcommentは送信前に拒否する: ${invalid.action}/${invalid.comment?.length}`, async () => {
    const rejected = await client.callTool({
      name: `application_requests_${invalid.action}`,
      arguments: {
        application_id: "42",
        decision_target: decisionTarget,
        comment: invalid.comment,
      },
    })
    expect(rejected.isError).toBe(true)
    expect(fixture.requests).toEqual([])
  })
}
