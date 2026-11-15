import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { destructive, readOnly, registerApiTool, segment, write } from "@/lib/api-tool"
import { intentNote, outputPath, stepUpNote, stepUpToken } from "@/lib/tool-inputs"

const workItemId = z.uuid().describe("Work item ID")
const content = z.string().trim().min(1).max(10000)
const digest = z.string().regex(/^[0-9a-f]{64}$/)
const command = {
  commandId: z.uuid().describe("New UUID per command; reuse it when retrying the same command"),
  expectedRevision: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .describe("Revision you read"),
  reason: z.string().trim().min(1).max(1000),
}
const retryNote = "Reuse the same commandId when retrying; after a conflict read the history again."

/** 依頼・受領・成果・確認・引き継ぎ・中止の作業の記録を扱う。確認と引き継ぎは人の再認証が要る。 */
export function registerWorkItemTools(server: McpServer) {
  registerApiTool(server, {
    name: "work_items_list",
    description: "List work items I participate in or administer. Continue with after.",
    annotations: readOnly,
    input: { after: z.uuid().optional(), limit: z.number().int().min(1).max(50).optional() },
    request: (query) => ({ path: "/system/work-items", query }),
  })
  registerApiTool(server, {
    name: "work_items_show",
    description: "Read the latest revision of a work item, including its result and handover.",
    annotations: readOnly,
    input: { id: workItemId },
    request: ({ id }) => ({ path: `/system/work-items/${segment(id)}` }),
  })
  registerApiTool(server, {
    name: "work_items_history",
    description: "Read the immutable revision history of a work item. Continue with after.",
    annotations: readOnly,
    input: {
      id: workItemId,
      after: z.number().int().nonnegative().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    request: ({ id, ...query }) => ({ path: `/system/work-items/${segment(id)}/history`, query }),
  })
  registerApiTool(server, {
    name: "work_items_evidence",
    description:
      "Download an evidence attachment of a work item to a local file. The content is not returned in the conversation.",
    annotations: readOnly,
    input: {
      id: workItemId,
      attachment_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/),
      output_path: outputPath,
    },
    request: ({ id, attachment_id, output_path }) => ({
      path: `/system/work-items/${segment(id)}/evidence/${segment(attachment_id)}`,
      outputPath: output_path,
    }),
  })
  registerApiTool(server, {
    name: "work_items_create",
    description: `Request work from an assignee with instructions and acceptance criteria; you become accountable. ${intentNote} ${retryNote}`,
    annotations: write,
    input: {
      id: workItemId,
      ...command,
      expectedRevision: z.literal(0),
      title: z.string().trim().min(1).max(300),
      instructions: content,
      acceptanceCriteria: content,
      assigneeAccountId: z.uuid(),
      dueAt: z.iso.datetime().nullable(),
      previousRevisionId: z.uuid().nullable(),
    },
    request: (body) => ({ path: "/system/work-items", method: "POST", json: body }),
  })
  registerApiTool(server, {
    name: "work_items_accept",
    description: `Accept a work item offered to me as the assignee. ${intentNote} ${retryNote}`,
    annotations: write,
    input: { id: workItemId, ...command },
    request: ({ id, ...body }) => ({
      path: `/system/work-items/${segment(id)}/accept`,
      method: "POST",
      json: body,
    }),
  })
  registerApiTool(server, {
    name: "work_items_submit_result",
    description: `Submit a result for review with a summary and evidence attachments (attachment_id and sha256). ${intentNote} ${retryNote}`,
    annotations: write,
    input: {
      id: workItemId,
      ...command,
      result: z.strictObject({
        summary: content,
        evidence: z
          .array(z.strictObject({ attachmentId: z.string().min(1).max(64), sha256: digest }))
          .max(20),
      }),
    },
    request: ({ id, ...body }) => ({
      path: `/system/work-items/${segment(id)}/results`,
      method: "POST",
      json: body,
    }),
  })
  for (const [name, action, summary] of [
    [
      "work_items_approve",
      "approve",
      "As the accountable person, confirm the exact result (resultId and resultDigest from a fresh read) and complete the work item.",
    ],
    [
      "work_items_return",
      "return",
      "As the accountable person, ask for corrections to the exact result (resultId and resultDigest from a fresh read).",
    ],
  ] as const) {
    registerApiTool(server, {
      name,
      description: `${summary} ${intentNote} ${stepUpNote} ${retryNote}`,
      annotations: write,
      input: {
        id: workItemId,
        ...command,
        resultId: z.uuid(),
        resultDigest: digest,
        step_up_token: stepUpToken,
      },
      request: ({ id, step_up_token, ...body }) => ({
        path: `/system/work-items/${segment(id)}/${action}`,
        method: "POST",
        json: body,
        stepUpToken: step_up_token,
      }),
    })
  }
  registerApiTool(server, {
    name: "work_items_request_handover",
    description: `Ask another person to take over accountability for a work item; they must accept it. ${intentNote} ${stepUpNote} ${retryNote}`,
    annotations: write,
    input: { id: workItemId, ...command, toAccountId: z.uuid(), step_up_token: stepUpToken },
    request: ({ id, step_up_token, ...body }) => ({
      path: `/system/work-items/${segment(id)}/handovers`,
      method: "POST",
      json: body,
      stepUpToken: step_up_token,
    }),
  })
  for (const [name, path, summary] of [
    ["work_items_accept_handover", "handovers/accept", "Accept accountability handed over to me."],
    [
      "work_items_decline_handover",
      "handovers/decline",
      "Decline accountability handed over to me.",
    ],
  ] as const) {
    registerApiTool(server, {
      name,
      description: `${summary} ${intentNote} ${stepUpNote} ${retryNote}`,
      annotations: write,
      input: { id: workItemId, ...command, handoverId: z.uuid(), step_up_token: stepUpToken },
      request: ({ id, step_up_token, ...body }) => ({
        path: `/system/work-items/${segment(id)}/${path}`,
        method: "POST",
        json: body,
        stepUpToken: step_up_token,
      }),
    })
  }
  registerApiTool(server, {
    name: "work_items_cancel",
    description: `As the accountable person, cancel a work item. ${intentNote} ${stepUpNote} ${retryNote}`,
    annotations: destructive,
    input: { id: workItemId, ...command, step_up_token: stepUpToken },
    request: ({ id, step_up_token, ...body }) => ({
      path: `/system/work-items/${segment(id)}/cancel`,
      method: "POST",
      json: body,
      stepUpToken: step_up_token,
    }),
  })
}
