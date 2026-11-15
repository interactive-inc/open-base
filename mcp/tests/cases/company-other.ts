import { ids } from "@/tests/cases/ids"
import type { ToolCase } from "@/tests/support/tool-cases"

const profile = {
  employeeId: "employee-1",
  organizationRevision: 7,
  personRevision: 2,
  effectiveOn: "2026-11-01",
}
const version = {
  organizationId: ids.organization,
  organizationRevision: 7,
  resourceId: null,
  resourceRevision: 0,
  effectiveOn: "2026-11-01",
  effectiveTo: null,
  sourceFingerprint: ids.digest,
}
const organizationProfile = {
  name: "Example",
  representativeName: "Example Representative",
  locale: "en-US",
  timeZone: "UTC",
  fiscalYearStartMonth: 4,
  version,
  reason: "Update",
}

export const companySelfCases: ReadonlyArray<ToolCase> = [
  { tool: "my_profile_show", args: {}, method: "GET", path: "/company/my-profile" },
  {
    tool: "my_profile_update",
    args: { idempotency_key: "profile-1", phone: "000-0000", profile, reason: "Update" },
    method: "PUT",
    path: "/company/my-profile",
    headers: { "idempotency-key": "profile-1" },
    body: { phone: "000-0000", profile, reason: "Update" },
  },
  { tool: "my_direct_reports", args: {}, method: "GET", path: "/company/my-direct-reports" },
  {
    tool: "my_organization_units",
    args: {},
    method: "GET",
    path: "/company/my-organization-units",
  },
  { tool: "inbox_counts", args: {}, method: "GET", path: "/company/inbox/counts" },
  { tool: "features_list", args: {}, method: "GET", path: "/company/features" },
]

export const companyAdminCases: ReadonlyArray<ToolCase> = [
  {
    tool: "organization_profile_show",
    args: {},
    method: "GET",
    path: "/company/organization-profile",
  },
  {
    tool: "organization_profile_update",
    args: { idempotency_key: "organization-profile-1", ...organizationProfile },
    method: "PUT",
    path: "/company/organization-profile",
    headers: { "idempotency-key": "organization-profile-1" },
    body: organizationProfile,
  },
  {
    tool: "workforce_connection_completions_list",
    args: {},
    method: "GET",
    path: "/company/workforce-connection-completions",
  },
  {
    tool: "workforce_connection_completions_create",
    args: { idempotency_key: "workforce-1", reason: "Every employee is connected" },
    method: "POST",
    path: "/company/workforce-connection-completions",
    headers: { "idempotency-key": "workforce-1" },
    body: { reason: "Every employee is connected" },
  },
  {
    tool: "definition_resource_adoptions_show",
    args: { command_id: "command-1" },
    method: "GET",
    path: "/company/definition-resource-adoptions/command-1",
  },
  {
    tool: "grade_award_archives_show",
    args: { command_id: "command-1" },
    method: "GET",
    path: "/company/grade-award-archives/command-1",
  },
  {
    tool: "grade_award_archives_by_employee",
    args: { employee_id: "employee-1" },
    method: "GET",
    path: "/company/grade-award-archives/by-employee/employee-1",
  },
  {
    tool: "personnel_action_events_list",
    args: { after_sequence: 10, limit: 5 },
    method: "GET",
    path: "/company/personnel-action-events",
    query: { after_sequence: "10", limit: "5" },
  },
  {
    tool: "personnel_action_requests_list",
    args: { status: "pending" },
    method: "GET",
    path: "/company/personnel-action-requests",
    query: { status: "pending" },
  },
]
