import { help } from "@/app/connectors/route"
import { createCliFixtures } from "@/tests/support/create-cli-fixtures"
import { describeApiCommands, STEP_UP_TOKEN } from "@/tests/support/describe-api-commands"

const fixtures = createCliFixtures("connectors")
const connector = crypto.randomUUID()
const exchange = crypto.randomUUID()
const definition = {
  id: connector,
  key: "example",
  name: "Example",
  direction: "outbound",
  transport: "api",
}
const definitionFile = fixtures.writeJson("connector.json", definition)
const pause = { name: "Example", status: "disabled", expected_revision: 1, reason: "停止する" }
const pauseFile = fixtures.writeJson("pause.json", pause)
const start = { id: exchange, connector_id: connector, idempotency_key: "exchange-1" }
const startFile = fixtures.writeJson("exchange.json", start)
const finish = { status: "succeeded", external_reference: "ref-1", error_code: null }
const finishFile = fixtures.writeJson("finish.json", finish)
const reconciliation = { id: crypto.randomUUID(), connector_id: connector, items: [] }
const reconciliationFile = fixtures.writeJson("reconciliation.json", reconciliation)
const requeue = { max_attempts: 3, available_at: "2026-04-01T00:00:00Z", reason: "再実行する" }
const requeueFile = fixtures.writeJson("requeue.json", requeue)
const delivery = { kind: "job", id: crypto.randomUUID(), idempotency_key: "job-1" }
const deliveryFile = fixtures.writeJson("delivery.json", delivery)
const stepUp = ["--step-up", STEP_UP_TOKEN]
const stepUpHeader = { "x-system-step-up": STEP_UP_TOKEN }

describeApiCommands({
  group: "connectors",
  help,
  cases: [
    {
      name: "list",
      argv: ["connectors", "list"],
      expected: { method: "GET", path: "/system/connectors" },
    },
    {
      name: "create",
      argv: ["connectors", "create", "--data", definitionFile, ...stepUp],
      expected: {
        method: "POST",
        path: "/system/connectors",
        headers: stepUpHeader,
        body: definition,
      },
    },
    {
      name: "update",
      argv: ["connectors", "update", connector, "--data", pauseFile, ...stepUp],
      expected: {
        method: "PATCH",
        path: `/system/connectors/${connector}`,
        headers: stepUpHeader,
        body: pause,
      },
    },
    {
      name: "exchanges list",
      argv: ["connectors", "exchanges", "list", "--connector-id", connector],
      expected: {
        method: "GET",
        path: "/system/integration-exchanges",
        query: { connector_id: connector },
      },
    },
    {
      name: "exchanges create",
      argv: ["connectors", "exchanges", "create", "--data", startFile],
      expected: { method: "POST", path: "/system/integration-exchanges", body: start },
    },
    {
      name: "exchanges show",
      argv: ["connectors", "exchanges", "show", exchange],
      expected: { method: "GET", path: `/system/integration-exchanges/${exchange}` },
    },
    {
      name: "exchanges update",
      argv: ["connectors", "exchanges", "update", exchange, "--data", finishFile],
      expected: {
        method: "PATCH",
        path: `/system/integration-exchanges/${exchange}`,
        body: finish,
      },
    },
    {
      name: "reconciliations list",
      argv: ["connectors", "reconciliations", "list", exchange],
      expected: {
        method: "GET",
        path: `/system/integration-exchanges/${exchange}/reconciliations`,
      },
    },
    {
      name: "reconciliations create",
      argv: ["connectors", "reconciliations", "create", exchange, "--data", reconciliationFile],
      expected: {
        method: "POST",
        path: `/system/integration-exchanges/${exchange}/reconciliations`,
        body: reconciliation,
      },
    },
    {
      name: "dead-letters list",
      argv: ["connectors", "dead-letters", "list"],
      expected: { method: "GET", path: "/system/dead-letters" },
    },
    {
      name: "dead-letters requeue",
      argv: ["connectors", "dead-letters", "requeue", "letter-1", "--data", requeueFile, ...stepUp],
      expected: {
        method: "POST",
        path: "/system/dead-letters/letter-1/requeue",
        headers: stepUpHeader,
        body: requeue,
      },
    },
    {
      name: "deliveries list",
      argv: ["connectors", "deliveries", "list", "--kind", "job", "--status", "dead_letter"],
      expected: {
        method: "GET",
        path: "/system/deliveries",
        query: { kind: "job", status: "dead_letter" },
      },
    },
    {
      name: "deliveries create",
      argv: ["connectors", "deliveries", "create", "--data", deliveryFile],
      expected: { method: "POST", path: "/system/deliveries", body: delivery },
    },
  ],
})
