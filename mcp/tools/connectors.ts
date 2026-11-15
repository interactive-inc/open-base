import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { readOnly, registerApiTool, segment, write } from "@/lib/api-tool"
import { intentNote, pathId, stepUpNote, stepUpToken } from "@/lib/tool-inputs"

const digest = z.string().regex(/^[0-9a-f]{64}$/)
const operationKey = z.string().regex(/^[a-z][a-z0-9_.:-]{0,199}$/)
const bodyIdempotencyKey = z
  .string()
  .regex(/^\S{1,255}$/)
  .describe("Reuse the same key when retrying the same request")
const delivery = {
  id: z.uuid(),
  payload_digest: digest,
  idempotency_key: bodyIdempotencyKey,
}
const schedule = {
  max_attempts: z.number().int().min(1).max(100),
  available_at: z.iso.datetime({ offset: true }),
}

/** 外部接続の定義、外部交換と照合、配送・dead letterの登録と再投入を扱う。secretは扱わない。 */
export function registerConnectorTools(server: McpServer) {
  registerApiTool(server, {
    name: "connectors_list",
    description:
      "List connector definitions. Secrets are never stored here. Requires integration:read.",
    annotations: readOnly,
    input: {},
    request: () => ({ path: "/system/connectors" }),
  })
  registerApiTool(server, {
    name: "connectors_create",
    description: `Define a connector without secrets. Requires integration:write. ${intentNote} ${stepUpNote}`,
    annotations: write,
    input: {
      id: z.uuid(),
      key: z.string().regex(/^[a-z][a-z0-9_-]{0,62}$/),
      name: z.string().trim().min(1).max(200),
      direction: z.enum(["inbound", "outbound", "bidirectional"]),
      transport: z.enum(["api", "file", "webhook"]),
      step_up_token: stepUpToken,
    },
    request: ({ step_up_token, ...body }) => ({
      path: "/system/connectors",
      method: "POST",
      json: body,
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "connectors_update",
    description: `Rename, disable or re-enable a connector at the revision you read. Requires integration:write. ${intentNote} ${stepUpNote}`,
    annotations: write,
    input: {
      connector_id: z.uuid(),
      name: z.string().trim().min(1).max(200),
      status: z.enum(["active", "disabled"]),
      expected_revision: z.number().int().min(1),
      reason: z.string().trim().min(1).max(200),
      step_up_token: stepUpToken,
    },
    request: ({ connector_id, step_up_token, ...body }) => ({
      path: `/system/connectors/${segment(connector_id)}`,
      method: "PATCH",
      json: body,
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "integration_exchanges_list",
    description: "List external exchanges of one connector. Requires integration:read.",
    annotations: readOnly,
    input: { connector_id: z.uuid() },
    request: (query) => ({ path: "/system/integration-exchanges", query }),
  })
  registerApiTool(server, {
    name: "integration_exchanges_create",
    description: `Start an external exchange identified by payload digest and idempotency key. Requires integration:write. ${intentNote}`,
    annotations: write,
    input: {
      id: z.uuid(),
      connector_id: z.uuid(),
      direction: z.enum(["inbound", "outbound"]),
      operation_key: operationKey,
      idempotency_key: bodyIdempotencyKey,
      payload_digest: digest,
    },
    request: (body) => ({ path: "/system/integration-exchanges", method: "POST", json: body }),
  })
  registerApiTool(server, {
    name: "integration_exchanges_show",
    description: "Read one external exchange. Requires integration:read.",
    annotations: readOnly,
    input: { exchange_id: z.uuid() },
    request: ({ exchange_id }) => ({
      path: `/system/integration-exchanges/${segment(exchange_id)}`,
    }),
  })
  registerApiTool(server, {
    name: "integration_exchanges_update",
    description: `Move an external exchange to succeeded, failed, cancelled or back to pending for retry. Requires integration:write. ${intentNote}`,
    annotations: write,
    input: {
      exchange_id: z.uuid(),
      status: z.enum(["pending", "succeeded", "failed", "cancelled"]),
      external_reference: z.string().trim().min(1).max(512).nullable().optional(),
      error_code: z
        .string()
        .regex(/^[a-z][a-z0-9_.:-]{0,199}$/)
        .nullable()
        .optional(),
    },
    request: ({ exchange_id, ...body }) => ({
      path: `/system/integration-exchanges/${segment(exchange_id)}`,
      method: "PATCH",
      json: body,
    }),
  })
  registerApiTool(server, {
    name: "integration_reconciliations_list",
    description: "List reconciliation history of an external exchange. Requires integration:read.",
    annotations: readOnly,
    input: { exchange_id: z.uuid() },
    request: ({ exchange_id }) => ({
      path: `/system/integration-exchanges/${segment(exchange_id)}/reconciliations`,
    }),
  })
  registerApiTool(server, {
    name: "integration_reconciliations_create",
    description: `Record an immutable external assertion and the per-item digest differences against the local version. Requires integration:write. ${intentNote}`,
    annotations: write,
    input: {
      exchange_id: z.uuid(),
      id: z.uuid(),
      connector_id: z.uuid(),
      assertion: z.object({
        id: z.uuid(),
        external_key: z.string().trim().min(1).max(512),
        external_version: z.string().trim().min(1).max(255),
        payload_digest: digest,
        observed_at: z.iso.datetime(),
      }),
      local_version: z.string().trim().min(1).max(255),
      items: z
        .array(
          z.object({
            key: z.string().trim().min(1).max(512),
            local_digest: digest.nullable(),
            external_digest: digest.nullable(),
          }),
        )
        .min(1)
        .max(10_000),
    },
    request: ({ exchange_id, ...body }) => ({
      path: `/system/integration-exchanges/${segment(exchange_id)}/reconciliations`,
      method: "POST",
      json: body,
    }),
  })
  registerApiTool(server, {
    name: "dead_letters_list",
    description: "List dead letters and their requeue state. Requires batch:view.",
    annotations: readOnly,
    input: {},
    request: () => ({ path: "/system/dead-letters" }),
  })
  registerApiTool(server, {
    name: "dead_letters_requeue",
    description: `Requeue a dead letter as a job once. Requires batch:write and system:admin. ${intentNote} ${stepUpNote}`,
    annotations: write,
    input: {
      dead_letter_id: pathId,
      ...schedule,
      reason: z.string().trim().min(1).max(200),
      step_up_token: stepUpToken,
    },
    request: ({ dead_letter_id, step_up_token, ...body }) => ({
      path: `/system/dead-letters/${segment(dead_letter_id)}/requeue`,
      method: "POST",
      json: body,
      stepUpToken: step_up_token,
    }),
  })
  registerApiTool(server, {
    name: "deliveries_list",
    description: "List job or outbox deliveries and their lifecycle. Requires batch:view.",
    annotations: readOnly,
    input: {
      kind: z.enum(["job", "outbox"]),
      status: z.enum(["queued", "leased", "succeeded", "dead_letter"]).optional(),
    },
    request: (query) => ({ path: "/system/deliveries", query }),
  })
  registerApiTool(server, {
    name: "deliveries_create",
    description: `Register a job, outbox or inbox delivery that references its payload only by digest. Retrying with the same idempotency_key is safe. Requires batch:write. ${intentNote}`,
    annotations: write,
    input: {
      delivery: z.discriminatedUnion("kind", [
        z.strictObject({
          ...delivery,
          kind: z.literal("job"),
          operation_key: operationKey,
          ...schedule,
        }),
        z.strictObject({
          ...delivery,
          kind: z.literal("outbox"),
          topic: operationKey,
          source_context: z.string().regex(/^[a-z][a-z0-9_-]{0,99}$/),
          source_kind: z.string().regex(/^[a-z][a-z0-9_-]{0,99}$/),
          source_id: z.string().regex(/^\S{1,255}$/),
          source_version: z.string().regex(/^\S{1,255}$/),
          ...schedule,
        }),
        z.strictObject({
          ...delivery,
          kind: z.literal("inbox"),
          source_key: operationKey,
          external_message_id: z.string().regex(/^\S{1,512}$/),
          received_at: z.iso.datetime({ offset: true }),
        }),
      ]),
    },
    request: ({ delivery }) => ({ path: "/system/deliveries", method: "POST", json: delivery }),
  })
}
