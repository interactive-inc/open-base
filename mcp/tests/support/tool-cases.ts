import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { createMcpTestClient } from "@/tests/support/mcp-test-client"

/** 一つのツール呼び出しと、偽APIに届くべき要求。 */
export type ToolCase = {
  tool: string
  args: Record<string, unknown>
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  query?: Record<string, string | string[]>
  headers?: Partial<Record<(typeof recordedHeaders)[number], string>>
  body?: unknown
  /** 本体をファイルへ書き出すツール。`output_path` は試験側で用意する。 */
  download?: true
  /** step-up を任意で受けるツール（汎用の呼び出し）。無ければ断ることを確かめない。 */
  optionalStepUp?: true
}

/** 試験で使う step-up トークン。人がCLIで取った値の形だけを真似る。 */
export const stepUp = "0123456789abcdef".repeat(4)

const recordedHeaders = [
  "x-company-organization-id",
  "if-match",
  "x-system-step-up",
  "idempotency-key",
] as const

type Recorded = {
  method: string
  path: string
  query: Record<string, string[]>
  headers: Record<string, string | null>
  body: string
}

/**
 * 本物のMCP serverをstdioで起動し、各ツールが偽APIへ送るmethod・経路・問い合わせ・ヘッダー・本体を確かめる。
 * step-up が要るツールは、トークンが無ければ要求を送らずに断ることも確かめる。
 */
export function testToolCases(title: string, cases: ReadonlyArray<ToolCase>) {
  test(
    title,
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "base-mcp-tools-"))
      const requests: Recorded[] = []
      const content = new Uint8Array([0, 1, 2, 255])
      const server = Bun.serve({
        port: 0,
        async fetch(request) {
          const url = new URL(request.url)
          const query: Record<string, string[]> = {}
          for (const key of new Set(url.searchParams.keys()))
            query[key] = url.searchParams.getAll(key)
          requests.push({
            method: request.method,
            path: url.pathname,
            query,
            headers: Object.fromEntries(
              recordedHeaders.map((name) => [name, request.headers.get(name)]),
            ),
            body: await request.text(),
          })
          if (/\/(evidence\/[^/]+|content|attachments\/[^/]+)$/.test(url.pathname))
            return new Response(content, {
              headers: { "content-type": "application/octet-stream" },
            })
          return Response.json({ status: "ok" })
        },
      })
      const client = await createMcpTestClient({
        entry: resolve(import.meta.dir, "../../index.ts"),
        baseUrl: server.url.toString(),
        configDirectory: directory,
      })
      try {
        const { tools } = await client.listTools()
        for (const [index, item] of cases.entries()) {
          const args = item.download
            ? { ...item.args, output_path: join(directory, `download-${index}`) }
            : item.args
          const before = requests.length
          const result = await client.callTool({ name: item.tool, arguments: args })
          expect({ tool: item.tool, isError: result.isError ?? false, result }).toMatchObject({
            tool: item.tool,
            isError: false,
          })
          expect(requests.length).toBe(before + 1)
          const sent = requests.at(-1)!
          expect({ tool: item.tool, method: sent.method, path: sent.path }).toEqual({
            tool: item.tool,
            method: item.method,
            path: `/api${item.path}`,
          })
          const query = Object.fromEntries(
            Object.entries(item.query ?? {}).map(([key, value]) => [
              key,
              Array.isArray(value) ? value : [value],
            ]),
          )
          expect({ tool: item.tool, query: sent.query }).toEqual({ tool: item.tool, query })
          expect({ tool: item.tool, headers: sent.headers }).toEqual({
            tool: item.tool,
            headers: Object.fromEntries(
              recordedHeaders.map((name) => [name, item.headers?.[name] ?? null]),
            ),
          })
          expect({
            tool: item.tool,
            body: sent.body === "" ? undefined : JSON.parse(sent.body),
          }).toEqual({
            tool: item.tool,
            body: item.body,
          })
          if (item.download) {
            const path = args.output_path as string
            expect(new Uint8Array(await readFile(path))).toEqual(content)
            // 書き出し先が既にあれば上書きしない。
            const again = await client.callTool({ name: item.tool, arguments: args })
            expect(again.isError).toBe(true)
          }

          const schema = tools.find((tool) => tool.name === item.tool)?.inputSchema
          expect(schema).toBeDefined()
          if ("step_up_token" in item.args && item.optionalStepUp !== true) {
            expect({ tool: item.tool, required: schema?.required }).toMatchObject({
              tool: item.tool,
              required: expect.arrayContaining(["step_up_token"]),
            })
            const { step_up_token: _, ...withoutStepUp } = args
            const count = requests.length
            const refused = await client.callTool({ name: item.tool, arguments: withoutStepUp })
            expect({ tool: item.tool, isError: refused.isError }).toEqual({
              tool: item.tool,
              isError: true,
            })
            expect(requests.length).toBe(count)
          }
        }
      } finally {
        await client.close()
        await server.stop(true)
        await rm(directory, { recursive: true, force: true })
      }
    },
    30_000,
  )
}
