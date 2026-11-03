import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiRequest } from "@/lib/api-client"
import {
  clientProjectCommandSchema,
  recordKinds,
} from "../../web/src/contexts/client-project/domain/client-project-command"

export function registerClientProjectTools(server: McpServer) {
  server.tool(
    "client_project_records",
    "List client projects or effort. A project includes planned, actual, remaining, forecast, and variance minutes. Set history with a record ID to read its revisions.",
    {
      kind: z.enum(recordKinds),
      id: z.uuid().optional(),
      project_id: z.uuid().optional().describe("Filter effort by project"),
      customer_id: z.uuid().optional().describe("Filter projects by customer"),
      search: z.string().trim().min(1).max(200).optional().describe("Search project names"),
      history: z.boolean().optional(),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async (query) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(await apiRequest("/client-project/records", { query })),
        },
      ],
    }),
  )
  server.tool(
    "client_project_save",
    "Create or revise a client-project record at the user's request. Include kind, UUID id, expected_revision (0 for creation), reason and the full record. Retry a failed request with the same body and key.",
    {
      idempotency_key: z.uuid(),
      record: clientProjectCommandSchema,
    },
    async ({ idempotency_key, record }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            await apiRequest("/client-project/records", {
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
