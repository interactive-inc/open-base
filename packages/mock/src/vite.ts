import { getResponse } from "msw"
import type { Plugin } from "vite"
import { createHandlers } from "./handlers.ts"
import { createMockState } from "./seed.ts"
import { createSqliteMock } from "./sqlite.ts"
import type { Scenario } from "./types.ts"

/** Vite自身のmiddlewareへ接続する。mock用のサーバーやポートを増やさない。 */
export function baseMockPlugin(
  options: { scenario?: Scenario; sqliteDirectory?: string } = {},
): Plugin {
  return {
    name: "base:mock-api",
    apply: "serve",
    async configureServer(server) {
      const database = options.sqliteDirectory
        ? await createSqliteMock({ directory: options.sqliteDirectory, scenario: options.scenario })
        : null
      const state = database?.state ?? createMockState(options.scenario)
      const handlers = createHandlers(state)
      server.httpServer?.once("close", () => database?.close())
      server.middlewares.use(async (incoming, outgoing, next) => {
        if (incoming.url === "/__mock/reset" && incoming.method === "POST") {
          Object.assign(state, createMockState(options.scenario))
          database?.save()
          outgoing.writeHead(204)
          outgoing.end()
          return
        }
        if (!incoming.url?.startsWith("/api/")) return next()
        try {
          const chunks: Uint8Array[] = []
          let bytes = 0
          for await (const chunk of incoming) {
            bytes += chunk.length
            if (bytes > 1024 * 1024) {
              outgoing.writeHead(413)
              outgoing.end()
              return
            }
            chunks.push(chunk)
          }
          const headers = new Headers()
          for (const [name, value] of Object.entries(incoming.headers))
            if (value) headers.set(name, Array.isArray(value) ? value.join(", ") : value)
          const method = incoming.method ?? "GET"
          const request = new Request(`http://localhost${incoming.url}`, {
            method,
            headers,
            body: ["GET", "HEAD"].includes(method) ? undefined : Buffer.concat(chunks),
          })
          const response = await getResponse(handlers, request)
          if (!response) {
            outgoing.writeHead(501)
            outgoing.end()
            return
          }
          database?.save()
          outgoing.writeHead(response.status, Object.fromEntries(response.headers))
          outgoing.end(Buffer.from(await response.arrayBuffer()))
        } catch {
          outgoing.writeHead(500, { "Content-Type": "application/json" })
          outgoing.end(JSON.stringify({ error: "mock の要求を処理できませんでした" }))
        }
      })
    },
  }
}
