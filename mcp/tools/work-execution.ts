import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiRequest } from "@/lib/api-client"
import {
  definitionInput,
  definitionQuery,
  executionQuery,
  executionInput,
  workSlug,
} from "../../web/src/contexts/work-execution/domain/work-execution-input"

export function registerWorkExecutionTools(server: McpServer) {
  server.tool(
    "work_execution_record",
    "Report a work execution through the current account. Mark AI assistance and the trigger as reported facts. Reuse the same execution ID for retries.",
    { execution: executionInput },
    async ({ execution }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            await apiRequest("/work-execution/runs", {
              method: "POST",
              json: execution,
            }),
          ),
        },
      ],
    }),
  )
  server.tool(
    "work_execution_definitions",
    "List registered work definitions and assigned agents.",
    definitionQuery.shape,
    async (query) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(await apiRequest("/work-execution/definitions", { query })),
        },
      ],
    }),
  )
  server.tool(
    "work_execution_save_definition",
    "Register, revise, or retire a work definition at the user's request. Use expected revision 0 for registration.",
    { definition: definitionInput },
    async ({ definition }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            await apiRequest("/work-execution/definitions", { method: "POST", json: definition }),
          ),
        },
      ],
    }),
  )
  server.tool(
    "work_execution_runs",
    "List reported agent executions by work slug, agent, tag, time, or reference.",
    executionQuery.shape,
    async (query) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(await apiRequest("/work-execution/runs", { query })),
        },
      ],
    }),
  )
  server.registerTool(
    "work_execution_delete_definition",
    {
      description:
        "Delete a work definition with all its revisions. Only definitions without recorded runs can be deleted; retire one that has runs instead. Requires explicit user intent. Pass the revision from a fresh read as expected_revision; after a 409 read again.",
      inputSchema: {
        slug: workSlug,
        expected_revision: z.number().int().positive().max(2147483647),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async ({ slug, expected_revision }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            await apiRequest(`/work-execution/definitions/${encodeURIComponent(slug)}`, {
              method: "DELETE",
              query: { expected_revision },
            }),
          ),
        },
      ],
    }),
  )
}
