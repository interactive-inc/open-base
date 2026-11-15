import { ids } from "@/tests/cases/ids"
import type { ToolCase } from "@/tests/support/tool-cases"

const template = {
  name: "Example request",
  category: "general",
  schema_json: { fields: [] },
}
const steps = [{ key: "manager", name: "Manager", approvers: [{ type: "direct_manager" }] }]

export const applicationCases: ReadonlyArray<ToolCase> = [
  {
    tool: "application_requests_admin_list",
    args: { status: "pending", limit: 10 },
    method: "GET",
    path: "/company/application-requests/admin",
    query: { status: "pending", limit: "10" },
  },
  {
    tool: "application_requests_me",
    args: { offset: 20 },
    method: "GET",
    path: "/company/application-requests/me",
    query: { offset: "20" },
  },
  {
    tool: "application_requests_update",
    args: { application_id: "12", payload: { amount: 1 } },
    method: "PUT",
    path: "/company/application-requests/12",
    body: { payload: { amount: 1 } },
  },
  {
    tool: "application_requests_withdraw",
    args: { application_id: "12" },
    method: "DELETE",
    path: "/company/application-requests/12",
  },
  {
    tool: "application_requests_resubmit",
    args: { application_id: "12", payload: { amount: 2 } },
    method: "POST",
    path: "/company/application-requests/12/resubmit",
    body: { payload: { amount: 2 } },
  },
  {
    tool: "application_workflow_repairs_list",
    args: {},
    method: "GET",
    path: "/company/application-requests/workflow-repairs",
  },
  {
    tool: "application_requests_reassign_workflow_step",
    args: { application_id: "12", candidate_employee_ids: [ids.a], reason: "No approver" },
    method: "POST",
    path: "/company/application-requests/12/reassign-workflow-step",
    body: { candidate_employee_ids: [ids.a], reason: "No approver" },
  },
  {
    tool: "application_templates_show",
    args: { code: "example" },
    method: "GET",
    path: "/company/application-templates/example",
  },
  {
    tool: "application_templates_create",
    args: { code: "example", ...template },
    method: "POST",
    path: "/company/application-templates",
    body: { code: "example", ...template },
  },
  {
    tool: "application_templates_update",
    args: { code: "example", ...template },
    method: "PUT",
    path: "/company/application-templates/example",
    body: template,
  },
  {
    tool: "application_templates_delete",
    args: { code: "example" },
    method: "DELETE",
    path: "/company/application-templates/example",
  },
  {
    tool: "application_templates_workflow_show",
    args: { code: "example" },
    method: "GET",
    path: "/company/application-templates/example/workflow",
  },
  {
    tool: "application_templates_workflow_save",
    args: { code: "example", expected_revision: 3, steps },
    method: "PUT",
    path: "/company/application-templates/example/workflow",
    body: { version: 1, steps, expected_revision: 3 },
  },
  {
    tool: "approval_delegations_list",
    args: {},
    method: "GET",
    path: "/company/approval-delegations",
  },
  {
    tool: "approval_delegations_create",
    args: {
      delegate_employee_code: "E002",
      starts_at: "2026-11-01T00:00:00+09:00",
      ends_at: "2026-11-08T00:00:00+09:00",
    },
    method: "POST",
    path: "/company/approval-delegations",
    body: {
      delegate_employee_code: "E002",
      template_code: null,
      starts_at: "2026-11-01T00:00:00+09:00",
      ends_at: "2026-11-08T00:00:00+09:00",
    },
  },
  {
    tool: "approval_delegations_revoke",
    args: { delegation_id: "5" },
    method: "DELETE",
    path: "/company/approval-delegations/5",
  },
]
