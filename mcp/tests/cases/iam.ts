import { ids } from "@/tests/cases/ids"
import { stepUp, type ToolCase } from "@/tests/support/tool-cases"

const role = { name: "Example reader", description: null, permission_keys: ["iam:read"] }
const principal = "/system/principals/principal-1"
const criteria = [
  { responsibility_code: "APPROVER", scope: { scope_type: "region", region_code: "R1" } },
]

export const iamCases: ReadonlyArray<ToolCase> = [
  { tool: "roles_list", args: {}, method: "GET", path: "/system/roles" },
  { tool: "roles_show", args: { role_id: ids.a }, method: "GET", path: `/system/roles/${ids.a}` },
  {
    tool: "roles_create",
    args: { key: "example:reader", ...role, step_up_token: stepUp },
    method: "POST",
    path: "/system/roles",
    headers: { "x-system-step-up": stepUp },
    body: { key: "example:reader", resource_type: null, ...role },
  },
  {
    tool: "roles_update",
    args: { role_id: ids.a, ...role, step_up_token: stepUp },
    method: "PATCH",
    path: `/system/roles/${ids.a}`,
    headers: { "x-system-step-up": stepUp },
    body: role,
  },
  {
    tool: "roles_delete",
    args: { role_id: ids.a, step_up_token: stepUp },
    method: "DELETE",
    path: `/system/roles/${ids.a}`,
    headers: { "x-system-step-up": stepUp },
  },
  {
    tool: "permission_definitions_list",
    args: {},
    method: "GET",
    path: "/system/permission-definitions",
  },
  { tool: "company_capabilities", args: {}, method: "GET", path: "/company/capabilities" },
  {
    tool: "authority_resolutions_resolve",
    args: {
      organization_id: ids.organization,
      as_of: "2026-11-01",
      subject_employee_id: null,
      criteria,
    },
    method: "POST",
    path: "/company/authority-resolutions",
    headers: { "x-company-organization-id": ids.organization },
    body: { as_of: "2026-11-01", subject_employee_id: null, criteria },
  },
  { tool: "principals_list", args: {}, method: "GET", path: "/system/principals" },
  {
    tool: "principals_show",
    args: { principal_id: "principal-1" },
    method: "GET",
    path: principal,
  },
  {
    tool: "principals_create",
    args: {
      principal: { kind: "connector", name: "Example connector", connector_id: ids.b },
      step_up_token: stepUp,
    },
    method: "POST",
    path: "/system/principals",
    headers: { "x-system-step-up": stepUp },
    body: { kind: "connector", name: "Example connector", connector_id: ids.b },
  },
  {
    tool: "principals_rename",
    args: {
      principal_id: "principal-1",
      name: "Renamed agent",
      expected_revision: 2,
      reason: "Rename",
      step_up_token: stepUp,
    },
    method: "PATCH",
    path: principal,
    headers: { "x-system-step-up": stepUp },
    body: { name: "Renamed agent", expected_revision: 2, reason: "Rename" },
  },
  {
    tool: "machine_credentials_list",
    args: { principal_id: "principal-1" },
    method: "GET",
    path: `${principal}/machine-credentials`,
  },
  {
    tool: "machine_credentials_create",
    args: {
      principal_id: "principal-1",
      name: "Nightly job",
      expires_at: null,
      reason: "Issue",
      step_up_token: stepUp,
    },
    method: "POST",
    path: `${principal}/machine-credentials`,
    headers: { "x-system-step-up": stepUp },
    body: { name: "Nightly job", expires_at: null, reason: "Issue" },
  },
  {
    tool: "machine_credentials_revoke",
    args: {
      principal_id: "principal-1",
      credential_id: "credential-1",
      reason: "Rotate",
      step_up_token: stepUp,
    },
    method: "DELETE",
    path: `${principal}/machine-credentials/credential-1`,
    headers: { "x-system-step-up": stepUp },
    body: { reason: "Rotate" },
  },
]
