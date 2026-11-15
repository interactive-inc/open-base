import { registerPerformanceReviewTools } from "@/tools/performance-review"
import { registerWorkExecutionTools } from "@/tools/work-execution"
import { registerClientProjectTools } from "@/tools/client-project"
import { registerCatalogTools } from "@/tools/catalogs"
import { registerDecisionTools } from "@/tools/decisions"
import { registerAccountTools } from "@/tools/accounts"
import { registerApplicationTools } from "@/tools/applications"
import { registerAttachmentTools } from "@/tools/attachments"
import { registerAuditTools } from "@/tools/audit"
import { registerCompanyAdminTools } from "@/tools/company-admin"
import { registerCompanyRecordTools } from "@/tools/company-records"
import { registerCompanySelfTools } from "@/tools/company-self"
import { registerConnectorTools } from "@/tools/connectors"
import { registerIamTools } from "@/tools/iam"
import { registerNotificationTools } from "@/tools/notifications"
import { registerRecordTools } from "@/tools/records"
import { registerWorkItemTools } from "@/tools/work-items"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { entityIdSegment } from "@/lib/entity-id.ts"
import { apiRequest } from "@/lib/api-client.ts"
import { uploadAttachment } from "@/lib/upload-attachment.ts"
import { organizationId, stepUpToken } from "@/lib/tool-inputs.ts"

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
  "Call a System or Company API endpoint using the current authenticated account. Mutations require explicit user intent; API authorization and validation apply. Application approve and reject are not accepted; use decision_url. Step-up grants and password changes are not accepted; a person runs `base step-up` in the CLI and passes the token as step_up_token.",
  {
    path: z
      .string()
      .regex(/^\/(system|company)(?:\/[A-Za-z0-9._~-]+)*$/)
      .refine((path) => !path.split("/").some((segment) => segment === "." || segment === ".."))
      // 申請の承認・却下は人がブラウザーで行う。汎用の呼び出しからも送らない。
      .refine((path) => !/^\/company\/application-requests\/[^/]+\/(approve|reject)$/.test(path), {
        message: "Approve and reject are done by a person in the browser. Use decision_url.",
      })
      // パスワードやIdPのトークンをMCPへ渡させない。再認証は人がCLIで行う。
      .refine(
        (path) =>
          path !== "/system/step-up-grants" &&
          !/^\/system\/accounts\/[^/]+\/password-credentials$/.test(path),
        { message: "Passwords and identity tokens are entered by a person in the CLI." },
      ),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
    query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    body: z.record(z.string(), z.unknown()).optional(),
    idempotency_key: z.string().max(255).optional(),
    organization_id: organizationId.optional(),
    if_match: z
      .string()
      .regex(/^(?:W\/)?(?:"\d+"|\d+)$/)
      .optional()
      .describe("Expected revision sent as if-match"),
    step_up_token: stepUpToken.optional(),
  },
  async ({
    path,
    method,
    query,
    body,
    idempotency_key,
    organization_id,
    if_match,
    step_up_token,
  }) => {
    const data = await apiRequest(path, {
      method,
      query,
      json: body,
      idempotencyKey: idempotency_key,
      organizationId: organization_id,
      ifMatch: if_match,
      stepUpToken: step_up_token,
    })
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

registerPerformanceReviewTools(server)
registerWorkExecutionTools(server)
registerClientProjectTools(server)
registerCatalogTools(server)
registerDecisionTools(server)
registerAccountTools(server)
registerIamTools(server)
registerCompanyRecordTools(server)
registerCompanySelfTools(server)
registerCompanyAdminTools(server)
registerApplicationTools(server)
registerWorkItemTools(server)
registerNotificationTools(server)
registerAuditTools(server)
registerConnectorTools(server)
registerAttachmentTools(server)
registerRecordTools(server)

const transport = new StdioServerTransport()
await server.connect(transport)
