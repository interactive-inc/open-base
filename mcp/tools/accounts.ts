import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { destructive, readOnly, registerApiTool, segment, write } from "@/lib/api-tool"
import {
  expectedRevision,
  idempotencyKey,
  intentNote,
  numericText,
  organizationId,
  stepUpNote,
  stepUpToken,
} from "@/lib/tool-inputs"
import { companyListQuery, withIds } from "@/lib/company-inputs"

const accountId = z.uuid().describe("System Account ID")
const email = z.string().trim().toLowerCase().email().min(3).max(254)
const resourceType = z
  .string()
  .min(3)
  .max(100)
  .regex(/^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/)

/** System Account・Identity・Role binding と、Company の Account 対応を扱う。パスワードは受け取らない。 */
export function registerAccountTools(server: McpServer) {
  registerApiTool(server, {
    name: "accounts_list",
    description: "List System Accounts without Company profile data. Requires iam:read.",
    annotations: readOnly,
    input: {},
    request: () => ({ path: "/system/accounts" }),
  })
  registerApiTool(server, {
    name: "accounts_show",
    description: "Read one System Account without Company profile data. Requires iam:read.",
    annotations: readOnly,
    input: { account_id: accountId },
    request: ({ account_id }) => ({ path: `/system/accounts/${segment(account_id)}` }),
  })
  registerApiTool(server, {
    name: "accounts_create",
    description: `Create an opaque System Account without a Company person. Requires iam:write. ${intentNote} ${stepUpNote}`,
    annotations: write,
    input: { step_up_token: stepUpToken },
    request: ({ step_up_token }) => ({
      path: "/system/accounts",
      method: "POST",
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "accounts_update_status",
    description: `Activate, suspend or lock a System Account. Suspending the last root or yourself is rejected. Requires iam:write. ${intentNote} ${stepUpNote}`,
    annotations: destructive,
    input: {
      account_id: accountId,
      status: z.enum(["active", "suspended", "locked"]),
      step_up_token: stepUpToken,
    },
    request: ({ account_id, status, step_up_token }) => ({
      path: `/system/accounts/${segment(account_id)}`,
      method: "PATCH",
      json: { status },
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "account_identities_list",
    description: "List the sign-in identities bound to an Account. Requires iam:read.",
    annotations: readOnly,
    input: { account_id: accountId },
    request: ({ account_id }) => ({ path: `/system/accounts/${segment(account_id)}/identities` }),
  })
  registerApiTool(server, {
    name: "account_identities_show",
    description: "Read one sign-in identity bound to an Account. Requires iam:read.",
    annotations: readOnly,
    input: { account_id: accountId, identity_id: z.uuid() },
    request: ({ account_id, identity_id }) => ({
      path: `/system/accounts/${segment(account_id)}/identities/${segment(identity_id)}`,
    }),
  })
  registerApiTool(server, {
    name: "account_identities_create",
    description: `Bind a passkey invitation or an external identity provider subject to an Account. Password identities are created by a person in the CLI, not here. Requires iam:write. ${intentNote} ${stepUpNote}`,
    annotations: write,
    input: {
      account_id: accountId,
      identity: z.discriminatedUnion("provider", [
        z.strictObject({ provider: z.literal("passkey"), email }),
        z.strictObject({
          provider: z.enum(["google", "github", "oidc"]),
          subject: z
            .string()
            .min(1)
            .max(255)
            .regex(/^[\x20-\x7e]+$/),
          email: z.string().trim().toLowerCase().email().max(254).nullable(),
          email_verified: z.boolean(),
        }),
      ]),
      step_up_token: stepUpToken,
    },
    request: ({ account_id, identity, step_up_token }) => ({
      path: `/system/accounts/${segment(account_id)}/identities`,
      method: "POST",
      json: identity,
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "account_identities_delete",
    description: `Remove a sign-in identity from an Account. The last active identity and the last root are protected. Requires iam:write. ${intentNote} ${stepUpNote}`,
    annotations: destructive,
    input: { account_id: accountId, identity_id: z.uuid(), step_up_token: stepUpToken },
    request: ({ account_id, identity_id, step_up_token }) => ({
      path: `/system/accounts/${segment(account_id)}/identities/${segment(identity_id)}`,
      method: "DELETE",
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "account_passkey_enrollments_create",
    description: `Reissue a passkey enrollment invitation for an Account that lost its passkey. Requires iam:write. ${intentNote} ${stepUpNote}`,
    annotations: write,
    input: { account_id: accountId, step_up_token: stepUpToken },
    request: ({ account_id, step_up_token }) => ({
      path: `/system/accounts/${segment(account_id)}/passkey-enrollments`,
      method: "POST",
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "account_role_bindings_list",
    description: "List the System Role binding history of an Account. Requires iam:read.",
    annotations: readOnly,
    input: { account_id: accountId },
    request: ({ account_id }) => ({
      path: `/system/accounts/${segment(account_id)}/role-bindings`,
    }),
  })
  registerApiTool(server, {
    name: "account_role_bindings_create",
    description: `Grant a System Role to an Account, optionally scoped to one resource. Self-grants and permissions you do not hold are rejected. Requires iam:write. ${intentNote} ${stepUpNote}`,
    annotations: write,
    input: {
      account_id: accountId,
      role_id: z.string().min(1).max(255),
      resource: z
        .strictObject({ type: resourceType, id: z.string().min(1).max(255) })
        .nullable()
        .default(null),
      step_up_token: stepUpToken,
    },
    request: ({ account_id, role_id, resource, step_up_token }) => ({
      path: `/system/accounts/${segment(account_id)}/role-bindings`,
      method: "POST",
      json: { role_id, resource },
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "account_role_bindings_delete",
    description: `Revoke a System Role binding from an Account. The last root is protected. Requires iam:write. ${intentNote} ${stepUpNote}`,
    annotations: destructive,
    input: { account_id: accountId, binding_id: z.uuid(), step_up_token: stepUpToken },
    request: ({ account_id, binding_id, step_up_token }) => ({
      path: `/system/accounts/${segment(account_id)}/role-bindings/${segment(binding_id)}`,
      method: "DELETE",
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "account_directory_list",
    description: "List Accounts with their Company contact mapping. Requires iam:read.",
    annotations: readOnly,
    input: {
      status: z.enum(["active", "suspended", "locked"]).optional(),
      limit: numericText.optional(),
      offset: numericText.optional(),
    },
    request: (query) => ({ path: "/company/account-directory", query }),
  })
  registerApiTool(server, {
    name: "account_employee_links_list",
    description: "List links between System Accounts and Company employees in one organization.",
    annotations: readOnly,
    input: { organization_id: organizationId, ...companyListQuery },
    request: ({ organization_id, id, ...query }) => ({
      path: withIds("/company/account-employee-links", id),
      query,
      organizationId: organization_id,
    }),
  })
  registerApiTool(server, {
    name: "account_employee_links_save",
    description: `Create, revise or void links between System Accounts and Company employees. Each resource is a full account-employee-link revision. ${intentNote} Reuse idempotency_key when retrying.`,
    annotations: write,
    input: {
      organization_id: organizationId,
      expected_revision: expectedRevision,
      idempotency_key: idempotencyKey,
      reason: z.string().trim().min(1).max(2_000),
      resources: z
        .array(
          z.strictObject({
            organizationId: z.string().regex(/^\S{1,255}$/),
            type: z.literal("account-employee-link"),
            id: z.string().regex(/^\S{1,255}$/),
            revision: z.number().int().min(1),
            state: z.enum(["active", "void"]),
            effectiveFrom: z.iso.date(),
            effectiveTo: z.iso.date().nullable(),
            attributes: z.strictObject({
              accountId: z.string().regex(/^\S{1,255}$/),
              employeeId: z.string().regex(/^\S{1,255}$/),
            }),
          }),
        )
        .min(1)
        .max(100),
    },
    request: ({ organization_id, expected_revision, idempotency_key, ...body }) => ({
      path: "/company/account-employee-links",
      method: "POST",
      json: body,
      organizationId: organization_id,
      ifMatch: String(expected_revision),
      idempotencyKey: idempotency_key,
    }),
  })
}
