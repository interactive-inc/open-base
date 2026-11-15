import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { createMcpTestClient } from "@/tests/support/mcp-test-client"

/** 承認・却下・差し戻しは人がブラウザーで行う。MCPは判断を受け付けず、開く画面のURLだけを返す。 */
test("MCP does not record decisions and returns the decision page URL", async () => {
  const directory = await mkdtemp(join(tmpdir(), "base-mcp-decision-"))
  const requests: string[] = []
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      requests.push(new URL(request.url).pathname)
      return Response.json({ status: "ok" })
    },
  })
  const client = await createMcpTestClient({
    entry: resolve(import.meta.dir, "../index.ts"),
    baseUrl: server.url.toString(),
    configDirectory: directory,
  })
  try {
    const { tools } = await client.listTools()
    const names = tools.map((tool) => tool.name)
    expect(names).toContain("decision_url")
    expect(names).not.toContain("application_requests_approve")
    expect(names).not.toContain("application_requests_reject")
    const command = tools.find((tool) => tool.name === "review_sheets_command")
    expect(JSON.stringify(command?.inputSchema)).not.toContain("decide")

    const origin = server.url.origin
    const sheetId = crypto.randomUUID()
    for (const [kind, id, url] of [
      ["application", "12", `${origin}/decisions/applications/12`],
      ["review_sheet", sheetId, `${origin}/decisions/reviews/${sheetId}`],
    ] as const) {
      const result = await client.callTool({ name: "decision_url", arguments: { kind, id } })
      expect(result.isError).not.toBe(true)
      const content = result.content as Array<{ type: string; text: string }>
      expect(JSON.parse(content[0]?.text ?? "{}")).toMatchObject({ url })
    }
    for (const [kind, id] of [
      ["application", "../1"],
      ["application", sheetId],
      ["review_sheet", "12"],
    ] as const) {
      const result = await client.callTool({ name: "decision_url", arguments: { kind, id } })
      expect(result.isError).toBe(true)
    }

    for (const action of ["approve", "reject"]) {
      const result = await client.callTool({
        name: "foundation_request",
        arguments: {
          path: `/company/application-requests/12/${action}`,
          method: "POST",
          body: { comment: null },
        },
      })
      expect(result.isError).toBe(true)
    }
    for (const action of ["approve", "reject", "return"]) {
      const result = await client.callTool({
        name: "review_sheets_command",
        arguments: {
          sheet_id: sheetId,
          idempotency_key: crypto.randomUUID(),
          command: {
            operation: "decide",
            action,
            expected_revision: 2,
            reason: "Check",
            target: {
              proposal_version: 1,
              proposal_digest: "0".repeat(64),
              task_key: "review",
              task_round: 1,
            },
          },
        },
      })
      expect(result.isError).toBe(true)
    }
    expect(requests).toEqual([])
  } finally {
    await client.close()
    await server.stop(true)
    await rm(directory, { recursive: true, force: true })
  }
}, 15_000)
