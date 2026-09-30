import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { entityIdSegment } from "@/lib/entity-id.ts"
import { apiRequest } from "@/lib/api-client.ts"
import { uploadAttachment } from "@/lib/upload-attachment.ts"

const server = new McpServer({
  name: "open-base",
  version: "0.1.0",
})

server.tool(
  "application_templates_list",
  "List application templates (request forms) that can be submitted. Each template defines its input schema.",
  {
    category: z.string().optional().describe("Filter by template category"),
  },
  async (args) => {
    const data = await apiRequest("/company/application-templates", {
      query: { category: args.category },
    })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "application_requests_submit",
  "Submit an application request based on a template. The payload must match the template's input schema.",
  {
    template_code: z.string().describe("Template code to submit against"),
    payload: z
      .record(z.string(), z.unknown())
      .describe("Form values matching the template's field schema"),
  },
  async (args) => {
    const data = await apiRequest("/company/application-requests", {
      method: "POST",
      json: { template_code: args.template_code, payload: args.payload },
    })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "application_requests_mine",
  "List my own application requests.",
  {
    status: z.string().optional().describe("Filter by status (e.g. pending, approved, rejected)"),
  },
  async (args) => {
    const data = await apiRequest("/company/application-requests", {
      query: { status: args.status },
    })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "application_requests_inbox",
  "List application requests waiting for my approval.",
  {},
  async () => {
    const data = await apiRequest("/company/application-requests/inbox")

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "application_requests_show",
  "Get a single application request by ID, including its payload and approval history.",
  {
    application_id: entityIdSegment.describe("The application request ID"),
  },
  async (args) => {
    const data = await apiRequest(`/company/application-requests/${args.application_id}`)

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "application_requests_approve",
  "Approve an application request that is waiting for my approval.",
  {
    application_id: entityIdSegment.describe("The application request ID"),
    comment: z.string().optional().describe("Optional approval comment"),
  },
  async (args) => {
    const data = await apiRequest(`/company/application-requests/${args.application_id}/approve`, {
      method: "POST",
      json: { comment: args.comment ?? null },
    })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "application_requests_reject",
  "Reject an application request that is waiting for my approval. A comment explaining the reason is required.",
  {
    application_id: entityIdSegment.describe("The application request ID"),
    comment: z.string().min(1).describe("Reason for rejection (required)"),
  },
  async (args) => {
    const data = await apiRequest(`/company/application-requests/${args.application_id}/reject`, {
      method: "POST",
      json: { comment: args.comment },
    })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "attachments_upload",
  "Upload a local file (receipt, certificate) and get an attachment_id to submit with a record. The file is read from the machine running this MCP server.",
  {
    file_path: z
      .string()
      .describe("Absolute path to a local file (.pdf, .jpg, .jpeg, .png, .heic)"),
  },
  async (args) => {
    const attachmentId = await uploadAttachment(args.file_path)

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ attachment_id: attachmentId }) }],
    }
  },
)

// SystemとCompanyの全APIを同じ認証・認可境界で利用する。
server.tool(
  "foundation_request",
  "Call a System or Company API endpoint using the current authenticated account. Mutations require explicit user intent; API authorization and validation apply.",
  {
    path: z
      .string()
      .regex(/^\/(system|company)(?:\/[A-Za-z0-9._~-]+)*$/)
      .refine((path) => !path.split("/").some((segment) => segment === "." || segment === "..")),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
    query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    body: z.record(z.string(), z.unknown()).optional(),
    idempotency_key: z.string().max(255).optional(),
  },
  async ({ path, method, query, body, idempotency_key }) => {
    const data = await apiRequest(path, {
      method,
      query,
      json: body,
      idempotencyKey: idempotency_key,
    })
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
