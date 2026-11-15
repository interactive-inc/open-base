import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { destructive, readOnly, registerApiTool, segment, write } from "@/lib/api-tool"
import { entityIdSegment } from "@/lib/entity-id"
import { intentNote, outputPath } from "@/lib/tool-inputs"
import { preservedRecordSearchSchema } from "../../web/src/contexts/system/domain/schemas/records/preserved-record-search.schema"

const search = preservedRecordSearchSchema.shape
const purpose = z.string().trim().min(1).max(255).describe("Why you read it; recorded in audit")

/** 個人情報の消去の申請と実行、保全記録の検索・原文・調書、案件の版の閲覧を扱う。 */
export function registerRecordTools(server: McpServer) {
  registerApiTool(server, {
    name: "personal_data_erasure_requests_create",
    description: `Request erasure of an attachment or of an employee's personal data through an approval template. The erasure runs only after a person approves it in the browser. Requires personal_data:erase or system:admin. ${intentNote}`,
    annotations: write,
    input: {
      request_id: z.uuid().describe("New UUID; reuse it when retrying"),
      template_code: z.string().trim().min(1).max(100),
      reason: z.string().trim().min(1).max(1_000),
      target: z.discriminatedUnion("kind", [
        z.strictObject({ kind: z.literal("attachment"), attachment_id: z.string().min(1).max(64) }),
        z.strictObject({
          kind: z.literal("employee"),
          employee_code: z.string().trim().min(1).max(64),
        }),
      ]),
    },
    request: (body) => ({
      path: "/company/personal-data-erasure-requests",
      method: "POST",
      json: body,
    }),
  })
  registerApiTool(server, {
    name: "personal_data_erasure_execute",
    description: `Execute the erasure of an approved erasure request. Cannot be undone. Requires personal_data:erase or system:admin. ${intentNote}`,
    annotations: destructive,
    input: { application_id: entityIdSegment.describe("Approved erasure request number") },
    request: ({ application_id }) => ({
      path: `/company/personal-data-erasure-requests/${segment(application_id)}/execute`,
      method: "POST",
    }),
  })
  registerApiTool(server, {
    name: "preserved_records_list",
    description:
      "Find preserved records I may read or export under the current disclosure conditions. Continue with cursor.",
    annotations: readOnly,
    input: {
      action: search.action,
      purpose,
      source_namespace: search.sourceNamespace.unwrap().optional(),
      owner_context: search.ownerContext.unwrap().optional(),
      record_kind: search.recordKind.unwrap().optional(),
      source_record_id: z.string().min(1).max(1000).optional(),
      cursor: z.uuid().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    request: (query) => ({ path: "/system/preserved-records", query }),
  })
  registerApiTool(server, {
    name: "preserved_records_content",
    description:
      "Write the preserved original (original bytes, export package, or attachment file) to a local file. package requires action export. Disclosure is audited. The content is not returned in the conversation.",
    annotations: readOnly,
    input: {
      record_id: z.uuid(),
      action: z.enum(["read", "export"]),
      purpose,
      format: z.enum(["original", "package", "attachment"]).optional(),
      output_path: outputPath,
    },
    request: ({ record_id, output_path, ...query }) => ({
      path: `/system/preserved-records/${segment(record_id)}/content`,
      query,
      outputPath: output_path,
    }),
  })
  registerApiTool(server, {
    name: "preserved_records_dossier",
    description:
      "Read the dossier of a preserved record: original, approvals, preservation and audit, each under its own disclosure qualification. Disclosure is audited.",
    annotations: readOnly,
    input: { record_id: z.uuid(), purpose },
    request: ({ record_id, purpose }) => ({
      path: `/system/preserved-records/${segment(record_id)}/dossier`,
      query: { purpose },
    }),
  })
  registerApiTool(server, {
    name: "proposal_versions_show",
    description:
      "Read one version of a System case proposal. Cases of other contexts are disclosed by their owners.",
    annotations: readOnly,
    input: {
      number: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    },
    request: ({ number, version }) => ({
      path: `/system/proposals/${segment(number)}/versions/${segment(version)}`,
    }),
  })
}
