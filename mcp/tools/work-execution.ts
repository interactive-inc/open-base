import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { apiRequest } from "@/lib/api-client"
import {
  definitionInput,
  definitionQuery,
  executionQuery,
} from "../../web/src/contexts/work-execution/domain/work-execution-input"

export function registerWorkExecutionTools(server: McpServer) {
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
}
