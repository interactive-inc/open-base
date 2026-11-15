import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { destructive, readOnly, registerApiTool, segment, write } from "@/lib/api-tool"
import { entityIdSegment } from "@/lib/entity-id"
import { intentNote, numericText } from "@/lib/tool-inputs"

const applicationId = entityIdSegment.describe("Application request number")
const templateCode = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/)
  .describe("Application template code")
const payload = z
  .record(z.string(), z.unknown())
  .describe("Form values matching the template's field schema")
const page = { limit: numericText.optional(), offset: numericText.optional() }
const templateBody = {
  name: z.string().min(1).max(500),
  category: z.string().min(1).max(200),
  description: z.string().max(3_000).nullable().optional(),
  schema_json: z.record(z.string(), z.unknown()).describe("Field schema of the form"),
  approver_roles: z.array(z.string().max(100)).max(20).optional(),
}
const decisionNote =
  "Approve and reject are done by a person in the browser; use decision_url for the page."

/** 申請の更新・取下げ・再提出、申請書式と承認経路、承認の委任、経路の修復を扱う。判断はしない。 */
export function registerApplicationTools(server: McpServer) {
  registerApiTool(server, {
    name: "application_requests_admin_list",
    description:
      "List every application request for audit and administration. Requires application:read:all.",
    annotations: readOnly,
    input: {
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      applicant_id: z.uuid().optional(),
      template_code: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      sort: z.string().optional(),
      ...page,
    },
    request: (query) => ({ path: "/company/application-requests/admin", query }),
  })
  registerApiTool(server, {
    name: "application_requests_me",
    description: "List application requests I submitted, newest first.",
    annotations: readOnly,
    input: page,
    request: (query) => ({ path: "/company/application-requests/me", query }),
  })
  registerApiTool(server, {
    name: "application_requests_update",
    description: `Replace the payload of my undecided application request as a new proposal version. ${intentNote} ${decisionNote}`,
    annotations: write,
    input: { application_id: applicationId, payload },
    request: ({ application_id, payload }) => ({
      path: `/company/application-requests/${segment(application_id)}`,
      method: "PUT",
      json: { payload },
    }),
  })
  registerApiTool(server, {
    name: "application_requests_withdraw",
    description: `Withdraw my unfinished application request. The decision history is kept. ${intentNote}`,
    annotations: destructive,
    input: { application_id: applicationId },
    request: ({ application_id }) => ({
      path: `/company/application-requests/${segment(application_id)}`,
      method: "DELETE",
    }),
  })
  registerApiTool(server, {
    name: "application_requests_resubmit",
    description: `Resubmit my returned application request with corrected values. ${intentNote} ${decisionNote}`,
    annotations: write,
    input: { application_id: applicationId, payload },
    request: ({ application_id, payload }) => ({
      path: `/company/application-requests/${segment(application_id)}/resubmit`,
      method: "POST",
      json: { payload },
    }),
  })
  registerApiTool(server, {
    name: "application_workflow_repairs_list",
    description:
      "List application requests whose current approval step has no qualified candidate. Requires workflow audit and template management permissions.",
    annotations: readOnly,
    input: page,
    request: (query) => ({ path: "/company/application-requests/workflow-repairs", query }),
  })
  registerApiTool(server, {
    name: "application_requests_reassign_workflow_step",
    description: `Assign new candidate employees to the current approval step of a stuck application request. This does not decide the request. ${intentNote}`,
    annotations: write,
    input: {
      application_id: applicationId,
      candidate_employee_ids: z.array(z.uuid()).min(1).max(20),
      required_approvals: z.number().int().positive().max(20).optional(),
      reason: z.string().trim().min(1).max(1_000),
    },
    request: ({ application_id, ...body }) => ({
      path: `/company/application-requests/${segment(application_id)}/reassign-workflow-step`,
      method: "POST",
      json: body,
    }),
  })
  registerApiTool(server, {
    name: "application_templates_show",
    description: "Read one application template and its field schema.",
    annotations: readOnly,
    input: { code: templateCode },
    request: ({ code }) => ({ path: `/company/application-templates/${segment(code)}` }),
  })
  registerApiTool(server, {
    name: "application_templates_create",
    description: `Create an application template. Requires application_template:manage. ${intentNote}`,
    annotations: write,
    input: {
      code: z.string().min(1).max(200),
      ...templateBody,
      completion_operation_key: z.literal("system.attachment.erase").optional(),
    },
    request: (body) => ({ path: "/company/application-templates", method: "POST", json: body }),
  })
  registerApiTool(server, {
    name: "application_templates_update",
    description: `Replace an application template's name, category, description and field schema. Requires application_template:manage. ${intentNote}`,
    annotations: write,
    input: { code: templateCode, ...templateBody },
    request: ({ code, ...body }) => ({
      path: `/company/application-templates/${segment(code)}`,
      method: "PUT",
      json: body,
    }),
  })
  registerApiTool(server, {
    name: "application_templates_delete",
    description: `Delete an application template. Requires application_template:manage. ${intentNote}`,
    annotations: destructive,
    input: { code: templateCode },
    request: ({ code }) => ({
      path: `/company/application-templates/${segment(code)}`,
      method: "DELETE",
    }),
  })
  registerApiTool(server, {
    name: "application_templates_workflow_show",
    description:
      "Read the approval workflow of an application template and its revision. Requires application_template:manage.",
    annotations: readOnly,
    input: { code: templateCode },
    request: ({ code }) => ({ path: `/company/application-templates/${segment(code)}/workflow` }),
  })
  registerApiTool(server, {
    name: "application_templates_workflow_save",
    description: `Replace the approval workflow of an application template at the revision you read. Steps use the shape returned by application_templates_workflow_show (key, name, approvers, approval_mode, conditions, rejection_behavior, ...); the API validates them. Requires application_template:manage. ${intentNote} After a revision conflict read again.`,
    annotations: write,
    input: {
      code: templateCode,
      expected_revision: z.number().int().nonnegative(),
      steps: z.array(z.record(z.string(), z.unknown())).min(1).max(20),
    },
    request: ({ code, expected_revision, steps }) => ({
      path: `/company/application-templates/${segment(code)}/workflow`,
      method: "PUT",
      json: { version: 1, steps, expected_revision },
    }),
  })
  registerApiTool(server, {
    name: "approval_delegations_list",
    description: "List approval delegations where I am the delegator or the delegate.",
    annotations: readOnly,
    input: {},
    request: () => ({ path: "/company/approval-delegations" }),
  })
  registerApiTool(server, {
    name: "approval_delegations_create",
    description: `Delegate my approval qualification to an active employee for a period, optionally for one template. ${intentNote}`,
    annotations: write,
    input: {
      delegate_employee_code: z.string().min(1).max(64),
      template_code: z.string().min(1).max(64).nullable().default(null),
      starts_at: z.iso.datetime({ offset: true }),
      ends_at: z.iso.datetime({ offset: true }),
    },
    request: (body) => ({ path: "/company/approval-delegations", method: "POST", json: body }),
  })
  registerApiTool(server, {
    name: "approval_delegations_revoke",
    description: `Revoke an approval delegation I created. ${intentNote}`,
    annotations: destructive,
    input: { delegation_id: entityIdSegment.describe("Approval delegation number") },
    request: ({ delegation_id }) => ({
      path: `/company/approval-delegations/${segment(delegation_id)}`,
      method: "DELETE",
    }),
  })
}
