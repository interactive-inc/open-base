import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { resolveBaseUrl } from "@/lib/api-client"

/** 判断の画面。申請は番号、評価シートはUUIDで開く。画面はオリジン直下にあり `/api` を付けない。 */
const pages = {
  application: { path: "/decisions/applications", id: /^[1-9]\d{0,15}$/ },
  review_sheet: {
    path: "/decisions/reviews",
    id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  },
} as const

/** 承認・却下・差し戻しは人がブラウザーで行う。MCPは開く画面のURLを返すだけで判断を記録しない。 */
export function registerDecisionTools(server: McpServer) {
  server.registerTool(
    "decision_url",
    {
      description:
        "Return the browser page where a person approves, rejects or returns an application request or a review sheet. Approve, reject and return are done by a person in the browser; this tool only returns the URL to open and never records a decision. Use an application request number or a review sheet UUID.",
      inputSchema: {
        kind: z.enum(["application", "review_sheet"]),
        id: z.string().min(1).max(128),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ kind, id }) => {
      const page = pages[kind]
      if (!page.id.test(id)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text:
                kind === "application"
                  ? "id must be an application request number"
                  : "id must be a review sheet UUID",
            },
          ],
        }
      }
      const url = new URL(`${page.path}/${id}`, resolveBaseUrl()).toString()
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                url,
                instruction:
                  "Ask a person to open this URL in a browser and decide there. No decision was recorded.",
              },
              null,
              2,
            ),
          },
        ],
      }
    },
  )
}
