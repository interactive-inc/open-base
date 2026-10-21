import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { PATCH as connectorPATCH } from "@system/interface/routes/system.connectors.$connectorId"
import { POST as connectorsPOST } from "@system/interface/routes/system.connectors"
import {
  GET as exchangeGET,
  PATCH as exchangePATCH,
} from "@system/interface/routes/system.integration-exchanges.$exchangeId"
import {
  GET as reconciliationsGET,
  POST as reconciliationsPOST,
} from "@system/interface/routes/system.integration-exchanges.$exchangeId.reconciliations"
import {
  GET as exchangesGET,
  POST as exchangesPOST,
} from "@system/interface/routes/system.integration-exchanges"
import { POST as principalsPOST } from "@system/interface/routes/system.principals"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { seedSystemStepUpGrant } from "@system/test/seed-system-step-up-grant.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const accountId = zAccountId.parse("0f6cc3a9-017b-4583-bd3c-b5d9c9957a67")
const connectorId = "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15"
const exchangeId = "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d"
const assertionId = "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d"
const reconciliationId = "c7e9a1b3-4d6f-4e8a-b0c2-3d5f7a9b1c4e"
const digestA = "a".repeat(64)
const digestB = "b".repeat(64)

/** 保存先の主キーが受け入れない値。文字列のID、大文字のUUID、nil UUID、max UUID。 */
function rejectedIds(label: string, uuid: string): ReadonlyArray<string> {
  return [
    `${label}:1`,
    uuid.toUpperCase(),
    "00000000-0000-0000-0000-000000000000",
    "ffffffff-ffff-ffff-ffff-ffffffffffff",
  ]
}

describe("System integration identifier HTTP", () => {
  test("ConnectorはUUIDではない主キーを400で拒否し、UUIDの主キーで作成する", async () => {
    const { client, fixture } = await createClient()

    for (const id of rejectedIds("connector", connectorId)) {
      const rejected = await client.system.connectors.$post({ json: connectorInput(id) })
      expect({ id, status: Number(rejected.status) }).toEqual({ id, status: 400 })
    }
    expect(await countRows(fixture, "system_connectors")).toBe(0)

    const created = await client.system.connectors.$post({ json: connectorInput(connectorId) })
    expect(created.status).toBe(201)
    expect(await countRows(fixture, "system_connectors")).toBe(1)
  })

  test("交換はUUIDではない主キーとConnectorの参照を400で拒否し、UUIDの主キーで作成する", async () => {
    const { client, fixture } = await createClient()
    expect(
      (await client.system.connectors.$post({ json: connectorInput(connectorId) })).status,
    ).toBe(201)

    for (const id of rejectedIds("exchange", exchangeId)) {
      const rejected = await client.system["integration-exchanges"].$post({
        json: exchangeInput(id, connectorId),
      })
      expect({ id, status: Number(rejected.status) }).toEqual({ id, status: 400 })
    }
    for (const id of rejectedIds("connector", connectorId)) {
      const rejected = await client.system["integration-exchanges"].$post({
        json: exchangeInput(exchangeId, id),
      })
      expect({ id, status: Number(rejected.status) }).toEqual({ id, status: 400 })
    }
    expect(await countRows(fixture, "system_integration_exchanges")).toBe(0)

    // operation_key と idempotency_key は主キーではないので、UUIDではない文字列のまま受け付ける。
    const created = await client.system["integration-exchanges"].$post({
      json: exchangeInput(exchangeId, connectorId),
    })
    expect(created.status).toBe(201)
    expect(await countRows(fixture, "system_integration_exchanges")).toBe(1)
  })

  test("照合はUUIDではないrunとassertionの主キーを400で拒否し、UUIDの主キーで作成する", async () => {
    const { client, fixture } = await createClient()
    expect(
      (await client.system.connectors.$post({ json: connectorInput(connectorId) })).status,
    ).toBe(201)
    expect(
      (
        await client.system["integration-exchanges"].$post({
          json: exchangeInput(exchangeId, connectorId),
        })
      ).status,
    ).toBe(201)
    const observedAt = new Date(Date.now() - 60_000).toISOString()

    for (const id of rejectedIds("reconciliation", reconciliationId)) {
      const rejected = await client.system["integration-exchanges"][
        ":exchangeId"
      ].reconciliations.$post({
        param: { exchangeId },
        json: reconciliationInput({ id, assertionId, observedAt }),
      })
      expect({ id, status: Number(rejected.status) }).toEqual({ id, status: 400 })
    }
    for (const id of rejectedIds("assertion", assertionId)) {
      const rejected = await client.system["integration-exchanges"][
        ":exchangeId"
      ].reconciliations.$post({
        param: { exchangeId },
        json: reconciliationInput({ id: reconciliationId, assertionId: id, observedAt }),
      })
      expect({ id, status: Number(rejected.status) }).toEqual({ id, status: 400 })
    }
    expect(await countRows(fixture, "system_external_assertions")).toBe(0)
    expect(await countRows(fixture, "system_reconciliation_runs")).toBe(0)

    // external_key・external_version・local_version・item の key は意味を持つ文字列のまま受け付ける。
    const created = await client.system["integration-exchanges"][
      ":exchangeId"
    ].reconciliations.$post({
      param: { exchangeId },
      json: reconciliationInput({ id: reconciliationId, assertionId, observedAt }),
    })
    expect(created.status).toBe(201)
    expect(await countRows(fixture, "system_external_assertions")).toBe(1)
    expect(await countRows(fixture, "system_reconciliation_runs")).toBe(1)
  })

  test("Connectorを指すPrincipalの参照も、UUIDではない値を400で拒否し、UUIDで作成する", async () => {
    const { client, fixture } = await createClient()
    expect(
      (await client.system.connectors.$post({ json: connectorInput(connectorId) })).status,
    ).toBe(201)

    for (const id of rejectedIds("connector", connectorId)) {
      const rejected = await client.system.principals.$post({
        json: { kind: "connector", name: "Connector machine", connector_id: id },
      })
      expect({ id, status: Number(rejected.status) }).toEqual({ id, status: 400 })
    }
    expect(await countRows(fixture, "system_principals")).toBe(0)

    const created = await client.system.principals.$post({
      json: { kind: "connector", name: "Connector machine", connector_id: connectorId },
    })
    expect(created.status).toBe(201)
    expect(await countRows(fixture, "system_principals")).toBe(1)
  })

  test("URLで受け取るConnectorと交換の参照も、UUIDではない値を400で拒否する", async () => {
    const { client } = await createClient()

    for (const id of rejectedIds("connector", connectorId)) {
      const listed = await client.system["integration-exchanges"].$get({
        query: { connector_id: id },
      })
      const updated = await client.system.connectors[":connectorId"].$patch({
        param: { connectorId: id },
        json: { name: "Generic", status: "disabled", expected_revision: 1, reason: "maintenance" },
      })
      expect({ id, listed: Number(listed.status), updated: Number(updated.status) }).toEqual({
        id,
        listed: 400,
        updated: 400,
      })
    }
    for (const id of rejectedIds("exchange", exchangeId)) {
      const found = await client.system["integration-exchanges"][":exchangeId"].$get({
        param: { exchangeId: id },
      })
      const updated = await client.system["integration-exchanges"][":exchangeId"].$patch({
        param: { exchangeId: id },
        json: { status: "failed", external_reference: null, error_code: "remote.unavailable" },
      })
      const listed = await client.system["integration-exchanges"][
        ":exchangeId"
      ].reconciliations.$get({ param: { exchangeId: id } })
      expect({
        id,
        found: Number(found.status),
        updated: Number(updated.status),
        listed: Number(listed.status),
      }).toEqual({ id, found: 400, updated: 400, listed: 400 })
    }
  })
})

async function createClient() {
  const fixture = await SystemSessionTestContext.create()
  const now = new Date()
  await fixture.database
    .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`)
    .bind(accountId, now.getTime())
    .run()
  await execSql(
    fixture.database,
    `INSERT INTO system_iam_roles
       (id, key, kind, name, created_at, updated_at)
     VALUES ('64965518-94f7-440b-87d6-5f01de16a196', 'system:integration', 'managed', 'Integration', 1, 1);
     INSERT INTO system_iam_role_permissions (role_id, permission_key)
     VALUES ('64965518-94f7-440b-87d6-5f01de16a196', 'integration:read'), ('64965518-94f7-440b-87d6-5f01de16a196', 'integration:write'), ('64965518-94f7-440b-87d6-5f01de16a196', 'iam:write');
     INSERT INTO system_role_bindings
       (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
     VALUES ('e8756177-3dce-4eae-8c24-31bd4fff3dca', '${accountId}', '64965518-94f7-440b-87d6-5f01de16a196', NULL, NULL, 1, NULL);`,
  )
  const stepUpToken = await seedSystemStepUpGrant(fixture, accountId, now)
  const applications = createSystemSessionApplications({
    context: fixture.context,
    jwtSecret: "system-session-test-jwt-secret",
    sessionTtlMilliseconds: 604_800_000,
  })
  if (applications instanceof Error) throw applications
  const session = await applications.issue.execute({
    accountId,
    tokenVersion: 0,
    now: new Date(),
    auditContext: { authorizationJson: null, metadataJson: null },
  })
  if (session instanceof Error) throw session
  if (session.kind === "rejected") throw new Error("session was rejected")

  const app = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => now)
      await next()
    })
    .post("/system/connectors", ...connectorsPOST)
    .patch("/system/connectors/:connectorId", ...connectorPATCH)
    .post("/system/principals", ...principalsPOST)
    .get("/system/integration-exchanges", ...exchangesGET)
    .post("/system/integration-exchanges", ...exchangesPOST)
    .get("/system/integration-exchanges/:exchangeId", ...exchangeGET)
    .patch("/system/integration-exchanges/:exchangeId", ...exchangePATCH)
    .get("/system/integration-exchanges/:exchangeId/reconciliations", ...reconciliationsGET)
    .post("/system/integration-exchanges/:exchangeId/reconciliations", ...reconciliationsPOST)
  const client = hc<typeof app>("http://system.test", {
    fetch: (input: Parameters<typeof app.request>[0], init?: Parameters<typeof app.request>[1]) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: "system-session-test-jwt-secret",
        NOW: now.toISOString(),
      }),
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      "x-system-step-up": stepUpToken,
    },
  })

  return { client, fixture }
}

async function countRows(fixture: SystemSessionTestContext, table: string): Promise<number> {
  const row = await fixture.database
    .prepare(`SELECT count(*) AS total FROM ${table}`)
    .first<{ total: number }>()

  return row?.total ?? Number.NaN
}

function connectorInput(id: string) {
  return {
    id,
    key: "generic",
    name: "Generic",
    direction: "bidirectional" as const,
    transport: "api" as const,
  }
}

function exchangeInput(id: string, connector: string) {
  return {
    id,
    connector_id: connector,
    direction: "outbound" as const,
    operation_key: "record.export",
    idempotency_key: "command:1",
    payload_digest: digestA,
  }
}

function reconciliationInput(
  props: Readonly<{ id: string; assertionId: string; observedAt: string }>,
) {
  return {
    id: props.id,
    connector_id: connectorId,
    assertion: {
      id: props.assertionId,
      external_key: "record:1",
      external_version: "1",
      payload_digest: digestB,
      observed_at: props.observedAt,
    },
    local_version: "7",
    items: [{ key: "record:1", local_digest: digestA, external_digest: digestB }],
  }
}
