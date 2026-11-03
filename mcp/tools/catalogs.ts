import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiRequest } from "@/lib/api-client"
import { customerCommandSchema } from "../../web/src/contexts/customer/domain/customer-command"
import { offeringCommandSchema } from "../../web/src/contexts/offering/domain/offering-command"

export function registerCatalogTools(server: McpServer) {
  for (const [catalog, schema, description] of [
    ["customer", customerCommandSchema, "customer organizations (search by name or alias)"],
    ["offering", offeringCommandSchema, "products and services (search by name or code)"],
  ] as const) {
    const path = `/${catalog}/records`
    server.tool(
      `${catalog}_records`,
      `List ${description}. Set history with an ID to inspect revisions.`,
      {
        id: z.uuid().optional(),
        search: z.string().trim().min(1).max(200).optional(),
        history: z.boolean().optional(),
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      async (query) => ({
        content: [
          { type: "text" as const, text: JSON.stringify(await apiRequest(path, { query })) },
        ],
      }),
    )
    server.tool(
      `${catalog}_save`,
      `Create or revise ${description} at the user's request. Expected revision 0 creates a record. Retry with the same body and key.`,
      {
        idempotency_key: z.uuid(),
        record: schema,
      },
      async ({ idempotency_key, record }) => ({
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              await apiRequest(path, {
                method: "POST",
                json: record,
                idempotencyKey: idempotency_key,
              }),
            ),
          },
        ],
      }),
    )
  }
}
