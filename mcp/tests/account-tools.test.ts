import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { accountCases } from "@/tests/cases/accounts"
import { ids } from "@/tests/cases/ids"
import { createMcpTestClient } from "@/tests/support/mcp-test-client"
import { stepUp, testToolCases } from "@/tests/support/tool-cases"

testToolCases("MCP account tools send the expected API requests", accountCases)

/** パスワードはMCPへ渡させない。人がCLIで標準入力から入れる。 */
test("MCP does not accept passwords for identities or credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "base-mcp-password-"))
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
    const names = (await client.listTools()).tools.map((tool) => tool.name)
    expect(names.some((name) => /password|step_up_grant/.test(name))).toBe(false)
    const result = await client.callTool({
      name: "account_identities_create",
      arguments: {
        account_id: ids.a,
        identity: { provider: "password", email: "you@example.com", password: "x".repeat(16) },
        step_up_token: stepUp,
      },
    })
    expect(result.isError).toBe(true)
    for (const [path, body] of [
      ["/system/step-up-grants", { method: "password", password: "x".repeat(16) }],
      [`/system/accounts/${ids.a}/password-credentials`, { password: "x".repeat(16) }],
    ] as const) {
      const refused = await client.callTool({
        name: "foundation_request",
        arguments: { path, method: "POST", body },
      })
      expect(refused.isError).toBe(true)
    }
    expect(requests).toEqual([])
  } finally {
    await client.close()
    await server.stop(true)
    await rm(directory, { recursive: true, force: true })
  }
}, 15_000)
