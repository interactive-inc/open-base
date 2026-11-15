import { ids } from "@/tests/cases/ids"
import { stepUp, type ToolCase } from "@/tests/support/tool-cases"

const range = { from: "2026-11-01T00:00:00Z", to: "2026-11-02T00:00:00Z" }
const policy = {
  scope: "*",
  commandId: ids.a,
  expectedRevision: 1,
  enabled: true,
  allowedFields: ["target_id"],
  allowedTargetTypes: null,
  allowedPurposes: ["investigation"],
  expiresAt: null,
  reason: "Allow investigations",
}

export const auditCases: ReadonlyArray<ToolCase> = [
  {
    tool: "company_audit_events_list",
    args: { action: "employee.updated", ...range, limit: 10 },
    method: "GET",
    path: "/company/audit-events",
    query: { action: "employee.updated", ...range, limit: "10" },
  },
  {
    tool: "company_audit_events_show",
    args: { event_id: ids.a },
    method: "GET",
    path: `/company/audit-events/${ids.a}`,
  },
  {
    tool: "company_audit_events_export",
    args: { outcome: "denied", ...range },
    method: "POST",
    path: "/company/audit-event-exports",
    body: { outcome: "denied", ...range },
  },
  {
    tool: "system_audit_events_list",
    args: { purpose: "investigation", outcome: "failed" },
    method: "GET",
    path: "/system/audit-events",
    query: { purpose: "investigation", outcome: "failed" },
  },
  {
    tool: "system_audit_events_show",
    args: { event_id: ids.a, purpose: "investigation" },
    method: "GET",
    path: `/system/audit-events/${ids.a}`,
    query: { purpose: "investigation" },
  },
  {
    tool: "audit_disclosure_policies_show",
    args: { scope: "*" },
    method: "GET",
    path: "/system/audit-disclosure-policies",
    query: { scope: "*" },
  },
  {
    tool: "audit_disclosure_policies_publish",
    args: { ...policy, step_up_token: stepUp },
    method: "POST",
    path: "/system/audit-disclosure-policies",
    headers: { "x-system-step-up": stepUp },
    body: policy,
  },
]
