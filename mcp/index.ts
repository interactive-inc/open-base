import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { entityIdSegment } from "@/lib/entity-id.ts"
import { applicationDecisionTarget } from "@/lib/application-decision-target"
import { toFoundationPath } from "@/lib/to-foundation-path"
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
    decision_target: applicationDecisionTarget,
    comment: z.string().max(3_000).optional().describe("Optional approval comment"),
  },
  async (args) => {
    const data = await apiRequest(`/company/application-requests/${args.application_id}/approve`, {
      method: "POST",
      json: { decision_target: args.decision_target, comment: args.comment ?? null },
    })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "application_requests_reject",
  "Reject an application request that is waiting for my approval. A comment explaining the reason is required.",
  {
    application_id: entityIdSegment.describe("The application request ID"),
    decision_target: applicationDecisionTarget,
    comment: z.string().min(1).max(3_000).describe("Reason for rejection (required)"),
  },
  async (args) => {
    const data = await apiRequest(`/company/application-requests/${args.application_id}/reject`, {
      method: "POST",
      json: { decision_target: args.decision_target, comment: args.comment },
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
      .transform((path, context) => {
        const canonical = toFoundationPath(path)
        if (canonical !== null) return canonical
        context.addIssue({
          code: "custom",
          message: "path must contain valid URI segments within /system or /company",
        })
        return z.NEVER
      })
      .describe(
        "Absolute API path under /system or /company. Percent-encode separators and reserved characters within IDs; pass query parameters separately.",
      ),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
    query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    body: z.record(z.string(), z.unknown()).optional(),
    idempotency_key: z.string().max(255).optional(),
    headers: z
      .strictObject({
        "x-company-organization-id": z
          .string()
          .regex(/^\S{1,255}$/)
          .optional(),
        "if-match": z
          .string()
          .regex(/^(?:W\/)?(?:"\d+"|\d+)$/)
          .optional(),
        "x-system-step-up": z
          .string()
          .regex(/^[0-9a-f]{64}$/)
          .optional(),
      })
      .optional()
      .describe(
        "API preconditions: Company organization, expected revision, and System step-up token. Use idempotency_key separately.",
      ),
  },
  async (args) => {
    const data = await apiRequest(args.path, {
      method: args.method,
      query: args.query,
      json: args.body,
      idempotencyKey: args.idempotency_key,
      headers: args.headers,
    })
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
