import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { readOnly, registerApiTool, segment, write } from "@/lib/api-tool"
import { intentNote, stepUpNote, stepUpToken } from "@/lib/tool-inputs"

const outcome = z.enum(["succeeded", "denied", "failed"])
const exactSecond = z.iso.datetime({ offset: true, precision: 0 })
const companyFilters = {
  actor_account_id: z.uuid().optional(),
  action: z.string().min(1).max(200).optional(),
  target_type: z.string().min(1).max(200).optional(),
  target_id: z.string().max(512).optional(),
  outcome: outcome.optional(),
}
const labels = z.array(z.string().trim().min(1).max(100)).max(64).nullable()

/** Companyの監査台帳とSystemの監査台帳の閲覧・出力、監査の開示条件を扱う。 */
export function registerAuditTools(server: McpServer) {
  registerApiTool(server, {
    name: "company_audit_events_list",
    description:
      "Search the Company audit ledger. Timestamps are exact seconds with offset. Continue with cursor. Reading is itself audited.",
    annotations: readOnly,
    input: {
      ...companyFilters,
      from: exactSecond.optional(),
      to: exactSecond.optional(),
      limit: z.number().int().min(1).max(100).optional(),
      cursor: z.string().min(1).max(4096).optional(),
    },
    request: (query) => ({ path: "/company/audit-events", query }),
  })
  registerApiTool(server, {
    name: "company_audit_events_show",
    description: "Read one Company audit event. Reading is itself audited.",
    annotations: readOnly,
    input: { event_id: z.uuid() },
    request: ({ event_id }) => ({ path: `/company/audit-events/${segment(event_id)}` }),
  })
  registerApiTool(server, {
    name: "company_audit_events_export",
    description: `Export Company audit events in a range of at most 31 days as CSV text. The export is itself audited. ${intentNote}`,
    annotations: { ...write, idempotentHint: true },
    input: { ...companyFilters, from: exactSecond, to: exactSecond },
    request: (body) => ({ path: "/company/audit-event-exports", method: "POST", json: body }),
  })
  registerApiTool(server, {
    name: "system_audit_events_list",
    description:
      "Search the append-only System audit ledger under the disclosure policy. Pass the boundary from the first page to later pages. Reading is itself audited.",
    annotations: readOnly,
    input: {
      purpose: z.string().trim().min(1).max(100).optional(),
      action: z.string().min(3).max(200).optional(),
      actor_account_id: z.string().min(1).max(255).optional(),
      outcome: outcome.optional(),
      target_type: z.string().min(1).max(200).optional(),
      target_id: z.string().min(1).max(512).optional(),
      occurred_from: z.iso.datetime().optional(),
      occurred_to: z.iso.datetime().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).max(10_000).optional(),
      boundary: z.string().max(64).optional(),
    },
    request: (query) => ({ path: "/system/audit-events", query }),
  })
  registerApiTool(server, {
    name: "system_audit_events_show",
    description:
      "Read one System audit event under the disclosure policy. Reading is itself audited.",
    annotations: readOnly,
    input: { event_id: z.uuid(), purpose: z.string().trim().min(1).max(100).optional() },
    request: ({ event_id, purpose }) => ({
      path: `/system/audit-events/${segment(event_id)}`,
      query: { purpose },
    }),
  })
  registerApiTool(server, {
    name: "audit_disclosure_policies_show",
    description:
      "Read the current audit disclosure policy for every Account (*) or one Account. Requires system:admin.",
    annotations: readOnly,
    input: { scope: z.union([z.literal("*"), z.uuid()]) },
    request: (query) => ({ path: "/system/audit-disclosure-policies", query }),
  })
  registerApiTool(server, {
    name: "audit_disclosure_policies_publish",
    description: `Publish a new revision of the audit disclosure policy: which fields, target types and purposes may be disclosed, until when. Requires system:admin. To explicitly replace a legacy Account policy, first read legacyPolicy and pass its revision as supersedesLegacyRevision. Omitting it keeps the legacy restriction. ${intentNote} ${stepUpNote}`,
    annotations: write,
    input: {
      scope: z.union([z.literal("*"), z.uuid()]),
      commandId: z.uuid(),
      expectedRevision: z.number().int().nonnegative(),
      supersedesLegacyRevision: z.number().int().positive().optional(),
      enabled: z.boolean(),
      allowedFields: z
        .array(
          z.enum([
            "actor_account_id",
            "target_id",
            "reason_code",
            "authorization_json",
            "before_json",
            "after_json",
            "metadata_json",
          ]),
        )
        .max(7),
      allowedTargetTypes: labels,
      allowedPurposes: labels,
      expiresAt: z.iso.datetime().nullable(),
      reason: z.string().trim().min(1).max(1000),
      step_up_token: stepUpToken,
    },
    request: ({ step_up_token, ...body }) => ({
      path: "/system/audit-disclosure-policies",
      method: "POST",
      json: body,
      stepUpToken: step_up_token,
    }),
  })
}
