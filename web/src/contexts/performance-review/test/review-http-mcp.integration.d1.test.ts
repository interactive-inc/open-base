import { expect, setDefaultTimeout, test } from "bun:test"
import { createMcpTestClient } from "../../../../../mcp/tests/support/mcp-test-client"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"
import { z } from "zod"
import { reviewHttpFixture as httpFixture } from "@/contexts/performance-review/test/review-http.test-support"

setDefaultTimeout(60000)

function payload(result: unknown) {
  const value = z
    .object({ content: z.array(z.object({ type: z.literal("text"), text: z.string() })) })
    .parse(result)
  return JSON.parse(value.content[0]!.text) as Record<string, unknown>
}

test("HTTP入口は認証とfeature gateを強制し、固定した規程と判断対象を返す", async () => {
  const f = await httpFixture()
  expect((await f.call(null, "/performance-review/cycles")).status).toBe(401)
  expect(
    (
      await f.call(0, "/performance-review/cycles", undefined, {
        DISABLED_DEFAULT_APPS: "performance-review",
      })
    ).status,
  ).toBe(404)
  const cycleResponse = await f.call(0, `/performance-review/cycles/${f.cycle.id}`)
  expect(cycleResponse.status).toBe(200)
  const cycle = (await cycleResponse.json()) as { goal_approval: { workflow: unknown } }
  expect(cycle.goal_approval.workflow).toMatchObject({ version: 1 })
  const invalid = await f.call(0, `/performance-review/sheets/${f.sheet.id}/commands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operation: "submit_goals", expected_revision: 1, reason: "提出" }),
  })
  expect(invalid.status).toBe(400)
  const submitted = await f.call(0, `/performance-review/sheets/${f.sheet.id}/commands`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify({ operation: "submit_goals", expected_revision: 1, reason: "提出" }),
  })
  expect(submitted.status).toBe(200)
  const submittedBody = (await submitted.json()) as { approval: { number: number } }
  const generic = await f.call(1, `/company/application-requests/${submittedBody.approval.number}`)
  expect(generic.status).toBe(404)
  const inbox = await f.call(1, "/performance-review/sheets?scope=inbox")
  expect(inbox.status).toBe(200)
  expect(await inbox.json()).toMatchObject({
    data: [{ id: f.sheet.id, decision_target: { task_key: "review" } }],
  })
})

test("実MCPからローカルD1のHTTPへ期間・目標を作り、本人の提出と二人の承認を通す", async () => {
  const f = await httpFixture(),
    directory = await mkdtemp(join(tmpdir(), "review-mcp-"))
  const tokens = ["review-owner", "review-first", "review-second"]
  const clients: Awaited<ReturnType<typeof createMcpTestClient>>[] = []
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const token = request.headers.get("authorization")?.replace(/^Bearer /, "")
      const index = tokens.indexOf(token ?? "")
      const url = new URL(request.url)
      url.pathname = url.pathname.replace(/^\/api(?=\/)/, "")
      return f.call(index < 0 ? null : index, url.pathname + url.search, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        duplex: "half",
      } as RequestInit)
    },
  })
  try {
    for (const [index, token] of tokens.entries()) {
      const configDir = join(directory, String(index))
      await mkdir(configDir)
      await writeFile(
        join(configDir, "settings.json"),
        JSON.stringify({ endpoints: { [server.url.toString()]: { accessToken: token } } }),
      )
      const client = await createMcpTestClient({
        entry: resolve(import.meta.dir, "../../../../../mcp/index.ts"),
        baseUrl: server.url.toString(),
        configDirectory: configDir,
      })
      clients.push(client)
    }
    const owner = clients[0]!,
      first = clients[1]!,
      second = clients[2]!
    const tools = await owner.listTools()
    expect(
      tools.tools.find((tool) => tool.name === "review_sheets_command")?.annotations,
    ).toMatchObject({ readOnlyHint: false, idempotentHint: true })
    const cycleId = crypto.randomUUID(),
      sheetId = crypto.randomUUID()
    const cycle = await owner.callTool({
      name: "review_cycles_create",
      arguments: {
        id: cycleId,
        name: "目標管理",
        starts_on: "2026-01-01",
        ends_on: "2026-12-31",
        reason: "評価期間を開始",
        goal_workflow: f.workflow,
        evaluation_workflow: f.workflow,
        idempotency_key: crypto.randomUUID(),
      },
    })
    expect(cycle.isError).not.toBe(true)
    expect(payload(cycle).id).toBe(cycleId)
    const created = await owner.callTool({
      name: "review_sheets_create",
      arguments: {
        id: sheetId,
        cycle_id: cycleId,
        goals: [f.goal],
        reason: "目標を記録",
        idempotency_key: crypto.randomUUID(),
      },
    })
    expect(created.isError, JSON.stringify(created)).not.toBe(true)
    const key = crypto.randomUUID(),
      submitArgs = {
        sheet_id: sheetId,
        idempotency_key: key,
        command: { operation: "submit_goals", expected_revision: 1, reason: "目標を提出" },
      }
    const submitted = await owner.callTool({ name: "review_sheets_command", arguments: submitArgs })
    expect(submitted.isError, JSON.stringify(submitted)).not.toBe(true)
    expect(
      payload(await owner.callTool({ name: "review_sheets_command", arguments: submitArgs })),
    ).toEqual(payload(submitted))
    const inbox = payload(
      await first.callTool({ name: "review_sheets_list", arguments: { scope: "inbox" } }),
    )
    expect(inbox.data).toMatchObject([{ id: sheetId }])
    for (const [index, client] of [first, second].entries()) {
      const read = payload(
        await client.callTool({ name: "review_sheets_show", arguments: { sheet_id: sheetId } }),
      )
      const input = {
        sheet_id: sheetId,
        idempotency_key: crypto.randomUUID(),
        command: {
          operation: "decide",
          action: "approve",
          expected_revision: read.revision,
          target: read.decision_target,
          reason: "目標を確認",
        },
      }
      const approved = await client.callTool({ name: "review_sheets_command", arguments: input })
      expect(approved.isError, JSON.stringify(approved)).not.toBe(true)
      expect(payload(approved).status).toBe(index === 0 ? "goals_pending" : "goals_approved")
    }
    const history = payload(
      await owner.callTool({ name: "review_sheets_history", arguments: { sheet_id: sheetId } }),
    )
    expect(history.data).toHaveLength(4)
    await f.database
      .prepare(
        "DELETE FROM system_iam_role_permissions WHERE permission_key = 'performance_review:read'",
      )
      .run()
    for (const permission of ["system:procedure:read", "system:procedure:read:all"])
      await f.database
        .prepare(
          "INSERT INTO system_iam_role_permissions (role_id, permission_key) SELECT id, ? FROM system_iam_roles WHERE key = 'custom:review-test'",
        )
        .bind(permission)
        .run()
    for (const name of ["review_sheets_show", "review_sheets_history"])
      expect((await first.callTool({ name, arguments: { sheet_id: sheetId } })).isError).toBe(true)
    const current = payload(submitted)
    const approval = z.object({ number: z.number() }).parse(current.approval)
    expect(
      (
        await first.callTool({
          name: "foundation_request",
          arguments: { path: `/system/proposals/${approval.number}/versions/1` },
        })
      ).isError,
    ).toBe(true)
  } finally {
    for (const client of clients) await client.close()
    await server.stop(true)
    await rm(directory, { recursive: true, force: true })
  }
})

test("直属上長が未定義の既定フローは提出を拒否し、案件や提出版を残さない", async () => {
  const f = await httpFixture(),
    cycleId = crypto.randomUUID(),
    sheetId = crypto.randomUUID()
  const headers = () => ({
    "content-type": "application/json",
    "idempotency-key": crypto.randomUUID(),
  })
  expect(
    (
      await f.call(0, "/performance-review/cycles", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          id: cycleId,
          name: "既定フロー",
          starts_on: "2026-01-01",
          ends_on: "2026-12-31",
          reason: "作成",
        }),
      })
    ).status,
  ).toBe(201)
  expect(
    (
      await f.call(0, "/performance-review/sheets", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ id: sheetId, cycle_id: cycleId, goals: [f.goal], reason: "作成" }),
      })
    ).status,
  ).toBe(201)
  expect(
    (
      await f.call(0, `/performance-review/sheets/${sheetId}/commands`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ operation: "submit_goals", expected_revision: 1, reason: "提出" }),
      })
    ).status,
  ).toBe(422)
  expect(
    await f.database.prepare("SELECT count(*) AS n FROM system_proposals").first<number>("n"),
  ).toBe(0)
  expect(
    await f.database
      .prepare("SELECT revision FROM performance_review_sheets WHERE id = ?")
      .bind(sheetId)
      .first<number>("revision"),
  ).toBe(1)
})
