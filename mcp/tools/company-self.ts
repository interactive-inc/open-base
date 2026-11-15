import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { readOnly, registerApiTool, write } from "@/lib/api-tool"
import { intentNote } from "@/lib/tool-inputs"

/** 本人のCompany上の表示・連絡先・部下・所属と、受信箱の件数を扱う。 */
export function registerCompanySelfTools(server: McpServer) {
  registerApiTool(server, {
    name: "my_profile_show",
    description:
      "Read my Company person display and the versions my_profile_update must send back.",
    annotations: readOnly,
    input: {},
    request: () => ({ path: "/company/my-profile" }),
  })
  registerApiTool(server, {
    name: "my_profile_update",
    description: `Update my Company phone number at the versions read with my_profile_show. ${intentNote} Reuse idempotency_key when retrying; after a conflict read again.`,
    annotations: write,
    input: {
      idempotency_key: z.string().regex(/^\S{1,200}$/),
      phone: z.string().trim().min(1).max(64).nullable(),
      profile: z.strictObject({
        employeeId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
        organizationRevision: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER - 1),
        personRevision: z
          .number()
          .int()
          .positive()
          .max(Number.MAX_SAFE_INTEGER - 1),
        effectiveOn: z.iso.date(),
      }),
      reason: z.string().trim().min(1).max(1500),
    },
    request: ({ idempotency_key, ...body }) => ({
      path: "/company/my-profile",
      method: "PUT",
      json: body,
      idempotencyKey: idempotency_key,
    }),
  })
  registerApiTool(server, {
    name: "my_direct_reports",
    description: "List the Company employees I currently manage directly.",
    annotations: readOnly,
    input: {},
    request: () => ({ path: "/company/my-direct-reports" }),
  })
  registerApiTool(server, {
    name: "my_organization_units",
    description: "List the Company organization units I currently belong to.",
    annotations: readOnly,
    input: {},
    request: () => ({ path: "/company/my-organization-units" }),
  })
  registerApiTool(server, {
    name: "inbox_counts",
    description: "Count my pending inbox items. Counts I may not see are zero.",
    annotations: readOnly,
    input: {},
    request: () => ({ path: "/company/inbox/counts" }),
  })
  registerApiTool(server, {
    name: "features_list",
    description: "List which product features are available in this deployment.",
    annotations: readOnly,
    input: {},
    request: () => ({ path: "/company/features" }),
  })
}
