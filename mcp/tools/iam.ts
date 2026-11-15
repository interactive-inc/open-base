import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { destructive, readOnly, registerApiTool, segment, write } from "@/lib/api-tool"
import { intentNote, organizationId, pathId, stepUpNote, stepUpToken } from "@/lib/tool-inputs"

const roleId = z.uuid().describe("System Role ID")
const permissionKeys = z
  .array(
    z
      .string()
      .min(3)
      .max(100)
      .regex(/^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/),
  )
  .max(100)
const roleBody = {
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000).nullable(),
  permission_keys: permissionKeys,
}
const principalName = z.string().trim().min(1).max(200)
const auditReason = z.string().trim().min(1).max(200)
const scope = z.discriminatedUnion("scope_type", [
  z.strictObject({
    scope_type: z.enum(["organization-unit", "legal-entity", "site", "workplace"]),
    scope_id: z.string().regex(/^\S{1,255}$/),
  }),
  z.strictObject({
    scope_type: z.literal("region"),
    region_code: z.string().trim().min(1).max(255),
  }),
  z.strictObject({
    scope_type: z.literal("amount"),
    currency_code: z.string().regex(/^[A-Z]{3}$/),
    amount: z.number().finite().nonnegative(),
  }),
])

/** System Role・権限定義・Principal・機械credentialと、Companyの判断資格の解決を扱う。 */
export function registerIamTools(server: McpServer) {
  registerApiTool(server, {
    name: "roles_list",
    description: "List System Roles and their permission keys. Requires iam:read.",
    annotations: readOnly,
    input: {},
    request: () => ({ path: "/system/roles" }),
  })
  registerApiTool(server, {
    name: "roles_show",
    description: "Read one System Role with its permission keys. Requires iam:read.",
    annotations: readOnly,
    input: { role_id: roleId },
    request: ({ role_id }) => ({ path: `/system/roles/${segment(role_id)}` }),
  })
  registerApiTool(server, {
    name: "roles_create",
    description: `Create a custom System Role. Permissions you do not hold cannot be added. Requires iam:write. ${intentNote} ${stepUpNote}`,
    annotations: write,
    input: {
      key: z
        .string()
        .min(3)
        .max(100)
        .regex(/^[a-z][a-z0-9_-]*(?::[a-z0-9][a-z0-9_-]*)+$/),
      resource_type: z.string().min(3).max(100).nullable().default(null),
      ...roleBody,
      step_up_token: stepUpToken,
    },
    request: ({ step_up_token, ...body }) => ({
      path: "/system/roles",
      method: "POST",
      json: body,
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "roles_update",
    description: `Replace the name, description and permission keys of a custom System Role. Managed Roles are immutable. Requires iam:write. ${intentNote} ${stepUpNote}`,
    annotations: write,
    input: { role_id: roleId, ...roleBody, step_up_token: stepUpToken },
    request: ({ role_id, step_up_token, ...body }) => ({
      path: `/system/roles/${segment(role_id)}`,
      method: "PATCH",
      json: body,
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "roles_delete",
    description: `Delete a custom System Role without active bindings. Requires iam:write. ${intentNote} ${stepUpNote}`,
    annotations: destructive,
    input: { role_id: roleId, step_up_token: stepUpToken },
    request: ({ role_id, step_up_token }) => ({
      path: `/system/roles/${segment(role_id)}`,
      method: "DELETE",
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "permission_definitions_list",
    description: "List the technical permission keys this deployment defines.",
    annotations: readOnly,
    input: {},
    request: () => ({ path: "/system/permission-definitions" }),
  })
  registerApiTool(server, {
    name: "company_capabilities",
    description: "Read the Company API version and capability catalog. Contains no company data.",
    annotations: readOnly,
    input: {},
    request: () => ({ path: "/company/capabilities" }),
  })
  registerApiTool(server, {
    name: "authority_resolutions_resolve",
    description:
      "Resolve which Company employees currently hold the given responsibilities on a date, separately from technical permissions. Reads a snapshot and records nothing. Requires company:read in the organization.",
    annotations: readOnly,
    input: {
      organization_id: organizationId,
      as_of: z.iso.date(),
      subject_employee_id: z
        .string()
        .regex(/^\S{1,255}$/)
        .nullable(),
      criteria: z
        .array(
          z.strictObject({
            responsibility_code: z.string().trim().min(1).max(255),
            scope: scope.nullable(),
          }),
        )
        .min(1)
        .max(20),
    },
    request: ({ organization_id, ...body }) => ({
      path: "/company/authority-resolutions",
      method: "POST",
      json: body,
      organizationId: organization_id,
    }),
  })
  registerApiTool(server, {
    name: "principals_list",
    description: "List non-human and human Principal classifications. Requires iam:read.",
    annotations: readOnly,
    input: {},
    request: () => ({ path: "/system/principals" }),
  })
  registerApiTool(server, {
    name: "principals_show",
    description: "Read one Principal classification. Requires iam:read.",
    annotations: readOnly,
    input: { principal_id: pathId },
    request: ({ principal_id }) => ({ path: `/system/principals/${segment(principal_id)}` }),
  })
  registerApiTool(server, {
    name: "principals_create",
    description: `Create an agent, service or connector Principal with its own Account. Requires iam:write. ${intentNote} ${stepUpNote}`,
    annotations: write,
    input: {
      principal: z.discriminatedUnion("kind", [
        z.strictObject({ kind: z.literal("agent"), name: principalName }),
        z.strictObject({ kind: z.literal("service"), name: principalName }),
        z.strictObject({
          kind: z.literal("connector"),
          name: principalName,
          connector_id: z.uuid(),
        }),
      ]),
      step_up_token: stepUpToken,
    },
    request: ({ principal, step_up_token }) => ({
      path: "/system/principals",
      method: "POST",
      json: principal,
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "principals_rename",
    description: `Rename a Principal at the revision you read. Requires iam:write and every permission of the target Account. ${intentNote} ${stepUpNote}`,
    annotations: write,
    input: {
      principal_id: pathId,
      name: principalName,
      expected_revision: z.number().int().min(1),
      reason: auditReason,
      step_up_token: stepUpToken,
    },
    request: ({ principal_id, step_up_token, ...body }) => ({
      path: `/system/principals/${segment(principal_id)}`,
      method: "PATCH",
      json: body,
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "machine_credentials_list",
    description:
      "List machine credential metadata of a Principal. Secrets are never returned. Requires iam:read.",
    annotations: readOnly,
    input: { principal_id: pathId },
    request: ({ principal_id }) => ({
      path: `/system/principals/${segment(principal_id)}/machine-credentials`,
    }),
  })
  registerApiTool(server, {
    name: "machine_credentials_create",
    description: `Issue a machine credential for a Principal. The raw secret is returned once; store it immediately and do not repeat it. Requires iam:write. ${intentNote} ${stepUpNote}`,
    annotations: write,
    input: {
      principal_id: pathId,
      name: principalName,
      expires_at: z.iso.datetime({ offset: true }).nullable(),
      reason: auditReason,
      step_up_token: stepUpToken,
    },
    request: ({ principal_id, step_up_token, ...body }) => ({
      path: `/system/principals/${segment(principal_id)}/machine-credentials`,
      method: "POST",
      json: body,
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "machine_credentials_revoke",
    description: `Revoke a machine credential of a Principal and keep its history. Requires iam:write. ${intentNote} ${stepUpNote}`,
    annotations: destructive,
    input: {
      principal_id: pathId,
      credential_id: pathId,
      reason: auditReason,
      step_up_token: stepUpToken,
    },
    request: ({ principal_id, credential_id, reason, step_up_token }) => ({
      path: `/system/principals/${segment(principal_id)}/machine-credentials/${segment(credential_id)}`,
      method: "DELETE",
      json: { reason },
      stepUpToken: step_up_token,
    }),
  })
}
