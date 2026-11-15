import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { destructive, readOnly, registerApiTool, segment, write } from "@/lib/api-tool"
import { intentNote, outputPath, stepUpNote, stepUpToken } from "@/lib/tool-inputs"
import { attachmentPreservationCommandSchema } from "../../web/src/contexts/system/domain/schemas/attachments/attachment-preservation.schema"

const attachmentId = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/)
  .describe("Attachment ID")

/** 添付の取り出し、未紐づけ添付の削除、保全（削除停止）とその解除を扱う。 */
export function registerAttachmentTools(server: McpServer) {
  registerApiTool(server, {
    name: "attachments_download",
    description:
      "Download one of my own attachments that is not yet linked to a record to a local file. The content is not returned in the conversation.",
    annotations: readOnly,
    input: { attachment_id: attachmentId, output_path: outputPath },
    request: ({ attachment_id, output_path }) => ({
      path: `/system/attachments/${segment(attachment_id)}`,
      outputPath: output_path,
    }),
  })
  registerApiTool(server, {
    name: "attachments_purge_unlinked",
    description: `Physically delete attachments that stayed unlinked past the retention period, up to 100 at a time. Cannot be undone. Requires system:admin. ${intentNote}`,
    annotations: destructive,
    input: {},
    request: () => ({ path: "/system/attachments/purge-unlinked", method: "POST" }),
  })
  registerApiTool(server, {
    name: "attachment_preservations_list",
    description:
      "List holds and retentions placed on an attachment and their releases. Requires system:admin.",
    annotations: readOnly,
    input: {
      attachment_id: attachmentId,
      cursor: z.uuid().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    request: ({ attachment_id, ...query }) => ({
      path: `/system/attachments/${segment(attachment_id)}/preservations`,
      query,
    }),
  })
  registerApiTool(server, {
    name: "attachment_preservations_create",
    description: `Place a hold or a retention on an attachment whose content matches sha256, so it is not deleted. Requires system:admin. ${intentNote} ${stepUpNote}`,
    annotations: write,
    input: {
      attachment_id: attachmentId,
      preservation: attachmentPreservationCommandSchema.omit({
        attachmentId: true,
        actorAccountId: true,
      }),
      step_up_token: stepUpToken,
    },
    request: ({ attachment_id, preservation, step_up_token }) => ({
      path: `/system/attachments/${segment(attachment_id)}/preservations`,
      method: "POST",
      json: preservation,
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "attachment_preservations_release",
    description: `Release one hold or retention of an attachment. Requires system:admin. ${intentNote} ${stepUpNote}`,
    annotations: destructive,
    input: {
      attachment_id: attachmentId,
      preservation_id: z.uuid(),
      operationId: z.uuid().describe("New UUID; reuse it when retrying"),
      expectedRevision: z.literal(1),
      reason: z.string().trim().min(1).max(1000),
      step_up_token: stepUpToken,
    },
    request: ({ attachment_id, preservation_id, step_up_token, ...body }) => ({
      path: `/system/attachments/${segment(attachment_id)}/preservations/${segment(preservation_id)}/release`,
      method: "POST",
      json: body,
      stepUpToken: step_up_token,
    }),
  })
}
