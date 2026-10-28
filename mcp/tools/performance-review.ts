import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiRequest } from "@/lib/api-client"

const uuid = z.uuid()
const reason = z.string().trim().min(1).max(3000)
const goal = z.strictObject({
  id: uuid,
  title: z.string().trim().min(1).max(500),
  success_criteria: z.string().trim().min(1).max(3000),
  weight: z.number().int().min(1).max(100),
  section_key: z
    .string()
    .regex(/^[a-z][a-z0-9_-]{0,49}$/)
    .optional(),
})
const assessment = z.strictObject({
  goal_id: uuid,
  score: z.number().int().min(0).max(100),
  comment: reason,
})
const selector = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("direct_manager") }),
  z.strictObject({ type: z.literal("department_manager") }),
  z.strictObject({ type: z.literal("management_chain") }),
  z.strictObject({ type: z.literal("target_department_manager") }),
  z.strictObject({ type: z.literal("employee"), employee_code: z.string().min(1).max(100) }),
  z.strictObject({
    type: z.literal("responsibility"),
    responsibility_type: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    organization_unit_code: z.string().nullable().optional(),
  }),
])
const workflow = z.strictObject({
  version: z.literal(1),
  steps: z
    .array(
      z.strictObject({
        key: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
        name: z.string().min(1).max(200),
        approvers: z.array(selector).min(1).max(20),
        approval_mode: z.enum(["any", "all", "minimum"]).optional(),
        minimum_approvals: z.number().int().min(1).max(100).optional(),
        rejection_behavior: z.enum(["reject", "return"]).optional(),
        allow_delegation: z.boolean().optional(),
        due_days: z.number().int().min(0).max(365).nullable().optional(),
        escalation_approvers: z.array(selector).max(20).optional(),
        condition_mode: z.enum(["all", "any"]).optional(),
        conditions: z
          .array(
            z.strictObject({
              source: z.enum(["payload", "applicant"]),
              field: z.string().min(1).max(200),
              operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "exists"]),
              value: z.unknown().optional(),
            }),
          )
          .max(20)
          .optional(),
      }),
    )
    .min(1)
    .max(20),
})
const common = { expected_revision: z.number().int().positive(), reason }
const command = z.discriminatedUnion("operation", [
  z.strictObject({
    ...common,
    operation: z.literal("revise_goals"),
    goals: z.array(goal).min(1).max(20),
  }),
  z.strictObject({
    ...common,
    operation: z.literal("self_evaluate"),
    assessments: z
      .array(assessment.extend({ actual: reason }))
      .min(1)
      .max(20),
  }),
  z.strictObject({ ...common, operation: z.literal("reopen_goals") }),
  z.strictObject({ ...common, operation: z.literal("submit_goals") }),
  z.strictObject({ ...common, operation: z.literal("submit_evaluation") }),
  z.strictObject({ ...common, operation: z.literal("cancel") }),
  z.strictObject({
    ...common,
    operation: z.literal("decide"),
    action: z.enum(["approve", "reject", "return"]),
    target: z.strictObject({
      proposal_version: z.number().int().positive(),
      proposal_digest: z.string().regex(/^[0-9a-f]{64}$/),
      task_key: z.string().min(1).max(100),
      task_round: z.number().int().positive(),
    }),
    assessments: z.array(assessment).min(1).max(20).optional(),
  }),
])
const page = {
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).max(100000).optional(),
}
const result = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
})
const read = { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
const write = { readOnlyHint: false, destructiveHint: false, idempotentHint: true }

/** 評価の操作を公開する。判断者や所有者を引数から指定させずAPIの本人認証を使う。 */
export function registerPerformanceReviewTools(server: McpServer) {
  server.registerTool(
    "review_cycles_list",
    {
      description:
        "List review periods and their fixed approval procedure references. Requires performance_review:read.",
      inputSchema: page,
      annotations: read,
    },
    async (args) => result(await apiRequest("/performance-review/cycles", { query: args })),
  )
  server.registerTool(
    "review_cycles_show",
    {
      description:
        "Read a review period and the complete frozen goal and evaluation approval workflows, including return/reject policy.",
      inputSchema: { cycle_id: uuid },
      annotations: read,
    },
    async ({ cycle_id }) => result(await apiRequest(`/performance-review/cycles/${cycle_id}`)),
  )
  server.registerTool(
    "review_cycles_create",
    {
      description:
        "Create an immutable review period, evaluation sections/weights/score scale, and separate goal/evaluation approval workflows. Requires performance_review:manage. Omitted workflows use the employee's current direct manager with return for corrections. Reuse the same idempotency_key when retrying the same request. Requires explicit user intent.",
      inputSchema: {
        id: uuid,
        name: z.string().trim().min(1).max(200),
        starts_on: z.iso.date(),
        ends_on: z.iso.date(),
        evaluation_policy: z
          .strictObject({
            version: z.literal(1),
            scale: z
              .array(
                z.strictObject({
                  value: z.number().int().min(0).max(100),
                  label: z.string().trim().min(1).max(200),
                }),
              )
              .min(2)
              .max(20),
            sections: z
              .array(
                z.strictObject({
                  key: z.string().regex(/^[a-z][a-z0-9_-]{0,49}$/),
                  name: z.string().trim().min(1).max(200),
                  weight: z.number().int().min(1).max(100),
                }),
              )
              .min(1)
              .max(10),
          })
          .optional(),
        reason,
        goal_workflow: workflow.optional(),
        evaluation_workflow: workflow.optional(),
        idempotency_key: uuid,
      },
      annotations: write,
    },
    async ({ idempotency_key, ...body }) =>
      result(
        await apiRequest("/performance-review/cycles", {
          method: "POST",
          idempotencyKey: idempotency_key,
          json: body,
        }),
      ),
  )
  server.registerTool(
    "review_sheets_list",
    {
      description:
        "List my review sheets or scope=inbox for requests I am currently qualified to decide. scope=all requires performance_review:read:all. Results are paginated.",
      inputSchema: {
        ...page,
        cycle_id: uuid.optional(),
        scope: z.enum(["mine", "all", "inbox"]).optional(),
      },
      annotations: read,
    },
    async (args) => result(await apiRequest("/performance-review/sheets", { query: args })),
  )
  server.registerTool(
    "review_sheets_create",
    {
      description:
        "Create my goal sheet for a review period. Goal IDs are stable UUIDs; weights must total 100 within each evaluation section before submission. The authenticated employee is the owner. Reuse idempotency_key on retry. Requires explicit user intent.",
      inputSchema: {
        id: uuid,
        cycle_id: uuid,
        goals: z.array(goal).max(20),
        reason,
        idempotency_key: uuid,
      },
      annotations: write,
    },
    async ({ idempotency_key, ...body }) =>
      result(
        await apiRequest("/performance-review/sheets", {
          method: "POST",
          idempotencyKey: idempotency_key,
          json: body,
        }),
      ),
  )
  server.registerTool(
    "review_sheets_show",
    {
      description:
        "Read a review sheet, its revision, and its current decision_target. Read this immediately before a decision. Owners, current qualified reviewers, and authorized company-wide readers can access it.",
      inputSchema: { sheet_id: uuid },
      annotations: read,
    },
    async ({ sheet_id }) => result(await apiRequest(`/performance-review/sheets/${sheet_id}`)),
  )
  server.registerTool(
    "review_sheets_history",
    {
      description:
        "Read immutable review history with reasons, actor chain, ratings and frozen snapshots. Uses the same current read authorization as the sheet.",
      inputSchema: { sheet_id: uuid, ...page },
      annotations: read,
    },
    async ({ sheet_id, ...query }) =>
      result(await apiRequest(`/performance-review/sheets/${sheet_id}/history`, { query })),
  )
  server.registerTool(
    "review_sheets_command",
    {
      description:
        "Revise goals, record self-assessment, submit goals/evaluation, decide or cancel. Requires explicit user intent. Use expected_revision from a fresh read; approval also requires its exact decision_target. Evaluation approval requires a score declared in the frozen evaluation_policy scale and a comment for every goal. A return/reject action must match the configured workflow. Approvals require current Company authority; admin permissions never substitute. Approved goals require explicit reopen_goals before amendment; this invalidates the active goal approval and clears self-assessment, so revised goals must be approved again. Finalized sheets cannot be rewritten. Reuse the same idempotency_key for retries; after a 409 read again and confirm the changed content before a new command.",
      inputSchema: { sheet_id: uuid, idempotency_key: uuid, command },
      annotations: write,
    },
    async ({ sheet_id, idempotency_key, command }) =>
      result(
        await apiRequest(`/performance-review/sheets/${sheet_id}/commands`, {
          method: "POST",
          idempotencyKey: idempotency_key,
          json: command,
        }),
      ),
  )
}
