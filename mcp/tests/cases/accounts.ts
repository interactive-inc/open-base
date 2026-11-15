import { ids } from "@/tests/cases/ids"
import { stepUp, type ToolCase } from "@/tests/support/tool-cases"

const account = `/system/accounts/${ids.a}`
const link = {
  organizationId: ids.organization,
  type: "account-employee-link",
  id: "link-1",
  revision: 1,
  state: "active",
  effectiveFrom: "2026-11-01",
  effectiveTo: null,
  attributes: { accountId: ids.a, employeeId: "employee-1" },
}

export const accountCases: ReadonlyArray<ToolCase> = [
  { tool: "accounts_list", args: {}, method: "GET", path: "/system/accounts" },
  { tool: "accounts_show", args: { account_id: ids.a }, method: "GET", path: account },
  {
    tool: "accounts_create",
    args: { step_up_token: stepUp },
    method: "POST",
    path: "/system/accounts",
    headers: { "x-system-step-up": stepUp },
  },
  {
    tool: "accounts_update_status",
    args: { account_id: ids.a, status: "suspended", step_up_token: stepUp },
    method: "PATCH",
    path: account,
    headers: { "x-system-step-up": stepUp },
    body: { status: "suspended" },
  },
  {
    tool: "account_identities_list",
    args: { account_id: ids.a },
    method: "GET",
    path: `${account}/identities`,
  },
  {
    tool: "account_identities_show",
    args: { account_id: ids.a, identity_id: ids.b },
    method: "GET",
    path: `${account}/identities/${ids.b}`,
  },
  {
    tool: "account_identities_create",
    args: {
      account_id: ids.a,
      identity: {
        provider: "oidc",
        subject: "subject-1",
        email: "you@example.com",
        email_verified: true,
      },
      step_up_token: stepUp,
    },
    method: "POST",
    path: `${account}/identities`,
    headers: { "x-system-step-up": stepUp },
    body: {
      provider: "oidc",
      subject: "subject-1",
      email: "you@example.com",
      email_verified: true,
    },
  },
  {
    tool: "account_identities_delete",
    args: { account_id: ids.a, identity_id: ids.b, step_up_token: stepUp },
    method: "DELETE",
    path: `${account}/identities/${ids.b}`,
    headers: { "x-system-step-up": stepUp },
  },
  {
    tool: "account_passkey_enrollments_create",
    args: { account_id: ids.a, step_up_token: stepUp },
    method: "POST",
    path: `${account}/passkey-enrollments`,
    headers: { "x-system-step-up": stepUp },
  },
  {
    tool: "account_role_bindings_list",
    args: { account_id: ids.a },
    method: "GET",
    path: `${account}/role-bindings`,
  },
  {
    tool: "account_role_bindings_create",
    args: { account_id: ids.a, role_id: ids.c, step_up_token: stepUp },
    method: "POST",
    path: `${account}/role-bindings`,
    headers: { "x-system-step-up": stepUp },
    body: { role_id: ids.c, resource: null },
  },
  {
    tool: "account_role_bindings_delete",
    args: { account_id: ids.a, binding_id: ids.c, step_up_token: stepUp },
    method: "DELETE",
    path: `${account}/role-bindings/${ids.c}`,
    headers: { "x-system-step-up": stepUp },
  },
  {
    tool: "account_directory_list",
    args: { status: "active", limit: 20 },
    method: "GET",
    path: "/company/account-directory",
    query: { status: "active", limit: "20" },
  },
  {
    tool: "account_employee_links_list",
    args: { organization_id: ids.organization, id: ["link-1", "link-2"], as_of: "2026-11-01" },
    method: "GET",
    path: "/company/account-employee-links",
    query: { id: ["link-1", "link-2"], as_of: "2026-11-01" },
    headers: { "x-company-organization-id": ids.organization },
  },
  {
    tool: "account_employee_links_save",
    args: {
      organization_id: ids.organization,
      expected_revision: 3,
      idempotency_key: "link-command-1",
      reason: "Connect the account",
      resources: [link],
    },
    method: "POST",
    path: "/company/account-employee-links",
    headers: {
      "x-company-organization-id": ids.organization,
      "if-match": "3",
      "idempotency-key": "link-command-1",
    },
    body: { reason: "Connect the account", resources: [link] },
  },
]
