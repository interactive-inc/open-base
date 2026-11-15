import { ids } from "@/tests/cases/ids"
import { stepUp, type ToolCase } from "@/tests/support/tool-cases"

const connector = {
  id: ids.a,
  key: "example",
  name: "Example",
  direction: "outbound",
  transport: "api",
}
const exchange = {
  id: ids.b,
  connector_id: ids.a,
  direction: "outbound",
  operation_key: "example.sync",
  idempotency_key: "exchange-1",
  payload_digest: ids.digest,
}
const reconciliation = {
  id: ids.c,
  connector_id: ids.a,
  assertion: {
    id: ids.d,
    external_key: "external-1",
    external_version: "1",
    payload_digest: ids.digest,
    observed_at: "2026-11-01T00:00:00Z",
  },
  local_version: "1",
  items: [{ key: "item-1", local_digest: ids.digest, external_digest: null }],
}
const schedule = { max_attempts: 3, available_at: "2026-11-01T00:00:00+09:00" }
const job = {
  id: ids.c,
  payload_digest: ids.digest,
  idempotency_key: "job-1",
  kind: "job",
  operation_key: "example.run",
  ...schedule,
}

export const connectorCases: ReadonlyArray<ToolCase> = [
  { tool: "connectors_list", args: {}, method: "GET", path: "/system/connectors" },
  {
    tool: "connectors_create",
    args: { ...connector, step_up_token: stepUp },
    method: "POST",
    path: "/system/connectors",
    headers: { "x-system-step-up": stepUp },
    body: connector,
  },
  {
    tool: "connectors_update",
    args: {
      connector_id: ids.a,
      name: "Example",
      status: "disabled",
      expected_revision: 1,
      reason: "Pause",
      step_up_token: stepUp,
    },
    method: "PATCH",
    path: `/system/connectors/${ids.a}`,
    headers: { "x-system-step-up": stepUp },
    body: { name: "Example", status: "disabled", expected_revision: 1, reason: "Pause" },
  },
  {
    tool: "integration_exchanges_list",
    args: { connector_id: ids.a },
    method: "GET",
    path: "/system/integration-exchanges",
    query: { connector_id: ids.a },
  },
  {
    tool: "integration_exchanges_create",
    args: exchange,
    method: "POST",
    path: "/system/integration-exchanges",
    body: exchange,
  },
  {
    tool: "integration_exchanges_show",
    args: { exchange_id: ids.b },
    method: "GET",
    path: `/system/integration-exchanges/${ids.b}`,
  },
  {
    tool: "integration_exchanges_update",
    args: { exchange_id: ids.b, status: "failed", error_code: "example.timeout" },
    method: "PATCH",
    path: `/system/integration-exchanges/${ids.b}`,
    body: { status: "failed", error_code: "example.timeout" },
  },
  {
    tool: "integration_reconciliations_list",
    args: { exchange_id: ids.b },
    method: "GET",
    path: `/system/integration-exchanges/${ids.b}/reconciliations`,
  },
  {
    tool: "integration_reconciliations_create",
    args: { exchange_id: ids.b, ...reconciliation },
    method: "POST",
    path: `/system/integration-exchanges/${ids.b}/reconciliations`,
    body: reconciliation,
  },
  { tool: "dead_letters_list", args: {}, method: "GET", path: "/system/dead-letters" },
  {
    tool: "dead_letters_requeue",
    args: { dead_letter_id: "dead-letter-1", ...schedule, reason: "Retry", step_up_token: stepUp },
    method: "POST",
    path: "/system/dead-letters/dead-letter-1/requeue",
    headers: { "x-system-step-up": stepUp },
    body: { ...schedule, reason: "Retry" },
  },
  {
    tool: "deliveries_list",
    args: { kind: "job", status: "queued" },
    method: "GET",
    path: "/system/deliveries",
    query: { kind: "job", status: "queued" },
  },
  {
    tool: "deliveries_create",
    args: { delivery: job },
    method: "POST",
    path: "/system/deliveries",
    body: job,
  },
]
