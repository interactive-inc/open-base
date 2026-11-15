import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { readOnly, registerApiTool, segment, write } from "@/lib/api-tool"
import { idempotencyKey, intentNote, pathId } from "@/lib/tool-inputs"
import { organizationProfileVersionSchema } from "../../web/src/contexts/company/domain/definitions/organization-profile-version.definition"

/** 会社の基本情報、接続の完了、移行・保全の記録、人事発令の読み取りを扱う。 */
export function registerCompanyAdminTools(server: McpServer) {
  registerApiTool(server, {
    name: "organization_profile_show",
    description:
      "Read the company name, representative, locale, time zone and fiscal year start with the version organization_profile_update must send back. Requires company:read in exactly one organization.",
    annotations: readOnly,
    input: {},
    request: () => ({ path: "/company/organization-profile" }),
  })
  registerApiTool(server, {
    name: "organization_profile_update",
    description: `Update the company profile at the version read with organization_profile_show. Requires Company administration. ${intentNote} Reuse idempotency_key when retrying; after a conflict read again.`,
    annotations: write,
    input: {
      idempotency_key: idempotencyKey,
      name: z.string().trim().min(1).max(2000),
      representativeName: z.string().trim().min(1).max(2000),
      locale: z.string(),
      timeZone: z.string(),
      fiscalYearStartMonth: z.number().int().min(1).max(12),
      version: organizationProfileVersionSchema,
      reason: z.string().trim().min(1).max(2000),
    },
    request: ({ idempotency_key, ...body }) => ({
      path: "/company/organization-profile",
      method: "PUT",
      json: body,
      idempotencyKey: idempotency_key,
    }),
  })
  registerApiTool(server, {
    name: "workforce_connection_completions_list",
    description:
      "Read whether every employee is connected to an Account and the completion record. Requires Company administration.",
    annotations: readOnly,
    input: {},
    request: () => ({ path: "/company/workforce-connection-completions" }),
  })
  registerApiTool(server, {
    name: "workforce_connection_completions_create",
    description: `Record once that every employee is connected to an Account. The API rechecks every connection. Requires Company administration. ${intentNote} Reuse idempotency_key when retrying.`,
    annotations: write,
    input: { idempotency_key: idempotencyKey, reason: z.string().trim().min(1).max(2000) },
    request: ({ idempotency_key, reason }) => ({
      path: "/company/workforce-connection-completions",
      method: "POST",
      json: { reason },
      idempotencyKey: idempotency_key,
    }),
  })
  registerApiTool(server, {
    name: "definition_resource_adoptions_show",
    description:
      "Read the migration evidence of a definition adoption command. Requires Company administration.",
    annotations: readOnly,
    input: { command_id: pathId },
    request: ({ command_id }) => ({
      path: `/company/definition-resource-adoptions/${segment(command_id)}`,
    }),
  })
  registerApiTool(server, {
    name: "grade_award_archives_show",
    description:
      "Read a preserved original grade award record and who preserved it. Requires Company administration.",
    annotations: readOnly,
    input: { command_id: pathId },
    request: ({ command_id }) => ({
      path: `/company/grade-award-archives/${segment(command_id)}`,
    }),
  })
  registerApiTool(server, {
    name: "grade_award_archives_by_employee",
    description:
      "List preserved original grade award records of an employee. Allowed for the employee or readers of employee attributes.",
    annotations: readOnly,
    input: { employee_id: pathId },
    request: ({ employee_id }) => ({
      path: `/company/grade-award-archives/by-employee/${segment(employee_id)}`,
    }),
  })
  registerApiTool(server, {
    name: "personnel_action_events_list",
    description:
      "List personnel action events in append order. Continue with after_sequence. Requires employee:attributes:read or employee:write.",
    annotations: readOnly,
    input: {
      after_sequence: z.number().int().nonnegative().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      recorded_since: z.iso.datetime({ offset: true }).optional(),
    },
    request: (query) => ({ path: "/company/personnel-action-events", query }),
  })
  registerApiTool(server, {
    name: "personnel_action_requests_list",
    description:
      "List personnel action requests I may see as a workflow participant or Company administrator.",
    annotations: readOnly,
    input: {
      target_employee_code: z.string().trim().min(1).max(64).optional(),
      status: z.enum(["pending", "approved", "rejected", "withdrawn"]).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    request: (query) => ({ path: "/company/personnel-action-requests", query }),
  })
}
