import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import type { systemConnectorResponse } from "@system/interface/responses/system-connector-response"
import type { systemIntegrationExchangeResponse } from "@system/interface/responses/system-integration-exchange-response"
import type { systemReconciliationRunResponse } from "@system/interface/responses/system-reconciliation-run-response"
import { PATCH as connectorPATCH } from "@system/interface/routes/system.connectors.$connectorId"
import {
  GET as connectorsGET,
  POST as connectorsPOST,
} from "@system/interface/routes/system.connectors"
import { POST as machineSessionPOST } from "@system/interface/routes/system.machine-sessions"
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
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { requireIssuedSystemSession } from "@system/test/require-issued-system-session.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { seedSystemStepUpGrant } from "@system/test/seed-system-step-up-grant.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const accountId = zAccountId.parse("0f6cc3a9-017b-4583-bd3c-b5d9c9957a67")
const scopedAccountId = zAccountId.parse("ddb2961e-afa3-4c3b-b707-060e04ee69c5")
const digestA = "a".repeat(64)
const digestB = "b".repeat(64)

describe("System integration HTTP", () => {
  test("Connector・交換・retry・照合を同じ認可と証跡モデルで実行する", async () => {
    const fixture = await SystemSessionTestContext.create()
    const clock = { value: new Date() }
    await seedAuthorization(fixture, clock.value)
    const stepUpToken = await seedSystemStepUpGrant(fixture, accountId, clock.value)
    const session = await issueSession(fixture, accountId)

    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("now", () => clock.value)
        await next()
      })
      .get("/system/connectors", ...connectorsGET)
      .post("/system/connectors", ...connectorsPOST)
      .patch("/system/connectors/:connectorId", ...connectorPATCH)
      .post("/system/machine-sessions", ...machineSessionPOST)
      .get("/system/integration-exchanges", ...exchangesGET)
      .post("/system/integration-exchanges", ...exchangesPOST)
      .get("/system/integration-exchanges/:exchangeId", ...exchangeGET)
      .patch("/system/integration-exchanges/:exchangeId", ...exchangePATCH)
      .get("/system/integration-exchanges/:exchangeId/reconciliations", ...reconciliationsGET)
      .post("/system/integration-exchanges/:exchangeId/reconciliations", ...reconciliationsPOST)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: "system-session-test-jwt-secret",
        NOW: clock.value.toISOString(),
      })
    const client = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        "x-system-step-up": stepUpToken,
      },
    })

    const connector = await client.system.connectors.$post({ json: connectorInput() })
    expect(connector.status).toBe(201)
    const createdAt = clock.value.toISOString()
    const connectorResponse: ReturnType<typeof systemConnectorResponse> = {
      ...connectorInput(),
      status: "active",
      revision: 1,
      created_at: createdAt,
      updated_at: createdAt,
    }
    expect(await connector.json()).toEqual({ connector: connectorResponse, replayed: false })
    const createdConnectors = await client.system.connectors.$get()
    expect(await createdConnectors.json()).toEqual({ connectors: [connectorResponse] })
    clock.value = new Date(clock.value.getTime() + 1_000)
    const connectorReplay = await client.system.connectors.$post({ json: connectorInput() })
    expect(connectorReplay.status).toBe(200)
    expect(await connectorReplay.json()).toEqual({ connector: connectorResponse, replayed: true })
    const machineCredential = await seedConnectorMachine(fixture, clock.value)
    const machineLogin = await app.request(
      "/system/machine-sessions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(machineCredential),
      },
      {
        DB: fixture.context.env.DB,
        JWT_SECRET: "system-session-test-jwt-secret",
        NOW: clock.value.toISOString(),
      },
    )
    expect(machineLogin.status).toBe(201)
    const exchange = await client.system["integration-exchanges"].$post({
      json: exchangeInput("b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d"),
    })
    expect(exchange.status).toBe(201)
    const exchangeResponse: ReturnType<typeof systemIntegrationExchangeResponse> = {
      ...exchangeInput("b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d"),
      status: "pending",
      attempt: 1,
      external_reference: null,
      last_error_code: null,
      created_at: clock.value.toISOString(),
      updated_at: clock.value.toISOString(),
      completed_at: null,
    }
    expect(await exchange.json()).toEqual({ exchange: exchangeResponse, replayed: false })
    const createdExchange = await client.system["integration-exchanges"][":exchangeId"].$get({
      param: { exchangeId: exchangeResponse.id },
    })
    expect(await createdExchange.json()).toEqual({ exchange: exchangeResponse })
    const createdExchanges = await client.system["integration-exchanges"].$get({
      query: { connector_id: exchangeResponse.connector_id },
    })
    expect(await createdExchanges.json()).toEqual({ exchanges: [exchangeResponse] })
    clock.value = new Date(clock.value.getTime() + 1_000)
    const replay = await client.system["integration-exchanges"].$post({
      json: exchangeInput("5c7e9a1b-3d5f-4a7c-9e1b-2d4f6a8c0e3b"),
    })
    expect(replay.status).toBe(200)
    expect(await replay.json()).toEqual({ exchange: exchangeResponse, replayed: true })

    clock.value = new Date(clock.value.getTime() + 1_000)
    const failed = await client.system["integration-exchanges"][":exchangeId"].$patch({
      param: { exchangeId: "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d" },
      json: { status: "failed", external_reference: null, error_code: "remote.unavailable" },
    })
    expect(failed.status).toBe(200)
    const failedResponse: ReturnType<typeof systemIntegrationExchangeResponse> = {
      ...exchangeResponse,
      status: "failed",
      last_error_code: "remote.unavailable",
      updated_at: clock.value.toISOString(),
      completed_at: clock.value.toISOString(),
    }
    expect(await failed.json()).toEqual({ exchange: failedResponse })
    clock.value = new Date(clock.value.getTime() + 1_000)
    const retried = await client.system["integration-exchanges"][":exchangeId"].$patch({
      param: { exchangeId: "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d" },
      json: { status: "pending", external_reference: null, error_code: null },
    })
    expect(retried.status).toBe(200)
    const retriedResponse: ReturnType<typeof systemIntegrationExchangeResponse> = {
      ...exchangeResponse,
      attempt: 2,
      updated_at: clock.value.toISOString(),
    }
    expect(await retried.json()).toEqual({ exchange: retriedResponse })

    clock.value = new Date(clock.value.getTime() + 1_000)
    const succeeded = await client.system["integration-exchanges"][":exchangeId"].$patch({
      param: { exchangeId: exchangeResponse.id },
      json: { status: "succeeded", external_reference: "record:1", error_code: null },
    })
    expect(succeeded.status).toBe(200)
    const succeededResponse: ReturnType<typeof systemIntegrationExchangeResponse> = {
      ...retriedResponse,
      status: "succeeded",
      external_reference: "record:1",
      updated_at: clock.value.toISOString(),
      completed_at: clock.value.toISOString(),
    }
    expect(await succeeded.json()).toEqual({ exchange: succeededResponse })
    const completedExchange = await client.system["integration-exchanges"][":exchangeId"].$get({
      param: { exchangeId: exchangeResponse.id },
    })
    expect(await completedExchange.json()).toEqual({ exchange: succeededResponse })
    const completedExchanges = await client.system["integration-exchanges"].$get({
      query: { connector_id: exchangeResponse.connector_id },
    })
    expect(await completedExchanges.json()).toEqual({ exchanges: [succeededResponse] })
    clock.value = new Date(clock.value.getTime() + 1_000)
    const completedReplay = await client.system["integration-exchanges"].$post({
      json: exchangeInput("5c7e9a1b-3d5f-4a7c-9e1b-2d4f6a8c0e3b"),
    })
    expect(completedReplay.status).toBe(200)
    expect(await completedReplay.json()).toEqual({ exchange: succeededResponse, replayed: true })

    const reconciled = await client.system["integration-exchanges"][
      ":exchangeId"
    ].reconciliations.$post({
      param: { exchangeId: "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d" },
      json: {
        id: "c7e9a1b3-4d6f-4e8a-b0c2-3d5f7a9b1c4e",
        connector_id: "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15",
        assertion: {
          id: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
          external_key: "record:1",
          external_version: "1",
          payload_digest: digestB,
          observed_at: new Date(clock.value.getTime() - 1_000).toISOString(),
        },
        local_version: "7",
        items: [{ key: "record:1", local_digest: digestA, external_digest: digestB }],
      },
    })
    expect(reconciled.status).toBe(201)
    const reconciliationResponse: ReturnType<typeof systemReconciliationRunResponse> = {
      id: "c7e9a1b3-4d6f-4e8a-b0c2-3d5f7a9b1c4e",
      exchange_id: exchangeResponse.id,
      assertion_id: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
      local_version: "7",
      status: "mismatched",
      item_count: 1,
      created_at: clock.value.toISOString(),
    }
    expect(await reconciled.json()).toEqual({ reconciliation: reconciliationResponse })
    const listed = await client.system["integration-exchanges"][":exchangeId"].reconciliations.$get(
      {
        param: { exchangeId: "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d" },
      },
    )
    expect(listed.status).toBe(200)
    expect(await listed.json()).toEqual({
      reconciliations: [reconciliationResponse],
    })
    const auditedResponses = await fixture.database
      .prepare(`SELECT action, before_json, after_json FROM system_audit_events
         WHERE target_type IN ('system:connector', 'system:integration_exchange', 'system:integration_reconciliation')
         ORDER BY occurred_at, action`)
      .all<{ action: string; before_json: string | null; after_json: string }>()
    expect(
      auditedResponses.results.map((event) => ({
        action: event.action,
        before: event.before_json === null ? null : JSON.parse(event.before_json),
        after: JSON.parse(event.after_json),
      })),
    ).toEqual([
      { action: "system.connector.created", before: null, after: connectorResponse },
      { action: "system.integration_exchange.created", before: null, after: exchangeResponse },
      {
        action: "system.integration_exchange.failed",
        before: exchangeResponse,
        after: failedResponse,
      },
      {
        action: "system.integration_exchange.pending",
        before: failedResponse,
        after: retriedResponse,
      },
      {
        action: "system.integration_exchange.succeeded",
        before: retriedResponse,
        after: succeededResponse,
      },
      {
        action: "system.integration_reconciliation.recorded",
        before: null,
        after: reconciliationResponse,
      },
    ])
    expect(
      await fixture.database
        .prepare(`SELECT count(*) AS total FROM system_audit_events
           WHERE action IN (
             'system.connector.created',
             'system.integration_exchange.created',
             'system.integration_exchange.failed',
             'system.integration_exchange.pending',
             'system.integration_reconciliation.recorded'
           )`)
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 5 })

    const scopedSession = await issueSession(fixture, scopedAccountId)
    const scopedClient = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: { authorization: `Bearer ${scopedSession.accessToken}` },
    })
    expect(
      (
        await scopedClient.system["integration-exchanges"].$get({
          query: { connector_id: "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15" },
        })
      ).status,
    ).toBe(200)
    const denied = await scopedClient.system["integration-exchanges"].$get({
      query: { connector_id: "0d9e8f7a-6b5c-4d3e-8f2a-1b0c9d8e7f6a" },
    })
    expect(Number(denied.status)).toBe(403)

    clock.value = new Date(clock.value.getTime() + 1_000)
    const disabled = await client.system.connectors[":connectorId"].$patch({
      param: { connectorId: "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15" },
      json: {
        name: "Generic",
        status: "disabled",
        expected_revision: 1,
        reason: "maintenance",
      },
    })
    expect(disabled.status).toBe(200)
    const disabledResponse: ReturnType<typeof systemConnectorResponse> = {
      ...connectorResponse,
      status: "disabled",
      revision: 2,
      updated_at: clock.value.toISOString(),
    }
    expect(await disabled.json()).toEqual({ connector: disabledResponse })
    const updatedConnectors = await client.system.connectors.$get()
    expect(await updatedConnectors.json()).toEqual({ connectors: [disabledResponse] })
    const disabledMachineLogin = await app.request(
      "/system/machine-sessions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(machineCredential),
      },
      {
        DB: fixture.context.env.DB,
        JWT_SECRET: "system-session-test-jwt-secret",
        NOW: clock.value.toISOString(),
      },
    )
    expect(Number(disabledMachineLogin.status)).toBe(401)
    expect(
      await fixture.database
        .prepare(`SELECT count(*) AS total FROM system_audit_events
           WHERE action IN ('auth.machine_token.issued', 'system.connector.updated')`)
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 2 })
  })

  test("外部の版が同じままでも、ローカルを直した後の一致を同じassertionで記録する", async () => {
    const fixture = await SystemSessionTestContext.create()
    const clock = { value: new Date() }
    await seedAuthorization(fixture, clock.value)
    await seedExchange(fixture)
    const session = await issueSession(fixture, accountId)
    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("now", () => clock.value)
        await next()
      })
      .get("/system/integration-exchanges/:exchangeId/reconciliations", ...reconciliationsGET)
      .post("/system/integration-exchanges/:exchangeId/reconciliations", ...reconciliationsPOST)
    const client = hc<typeof app>("http://system.test", {
      fetch: (input: Parameters<typeof app.request>[0], init?: Parameters<typeof app.request>[1]) =>
        app.request(input, init, {
          DB: fixture.context.env.DB,
          JWT_SECRET: "system-session-test-jwt-secret",
          NOW: clock.value.toISOString(),
        }),
      headers: { authorization: `Bearer ${session.accessToken}` },
    })
    const reconciliations = client.system["integration-exchanges"][":exchangeId"].reconciliations
    const assertion = {
      id: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
      external_key: "record:1",
      external_version: "1",
      payload_digest: digestB,
      observed_at: new Date(clock.value.getTime() - 1_000).toISOString(),
    }

    const mismatched = await reconciliations.$post({
      param: { exchangeId: "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d" },
      json: {
        id: "c7e9a1b3-4d6f-4e8a-b0c2-3d5f7a9b1c4e",
        connector_id: "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15",
        assertion,
        local_version: "7",
        items: [{ key: "record:1", local_digest: digestA, external_digest: digestB }],
      },
    })
    expect(mismatched.status).toBe(201)
    expect(await mismatched.json()).toMatchObject({
      reconciliation: {
        assertion_id: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
        local_version: "7",
        created_at: clock.value.toISOString(),
        status: "mismatched",
      },
    })
    const assertionsAfterFirst = await assertionRows(fixture)
    expect(assertionsAfterFirst).toMatchObject([
      {
        id: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
        external_version: "1",
        payload_digest: digestB,
      },
    ])

    clock.value = new Date(clock.value.getTime() + 1_000)
    const matched = await reconciliations.$post({
      param: { exchangeId: "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d" },
      json: {
        id: "d8f0b2c4-5e7a-4f9b-a1d3-4e6a8b0c2d5f",
        connector_id: "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15",
        assertion,
        local_version: "8",
        items: [{ key: "record:1", local_digest: digestB, external_digest: digestB }],
      },
    })
    expect(Number(matched.status)).toBe(201)
    expect(await matched.json()).toMatchObject({
      reconciliation: {
        assertion_id: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
        local_version: "8",
        created_at: clock.value.toISOString(),
        status: "matched",
      },
    })

    clock.value = new Date(clock.value.getTime() + 1_000)
    const overwritten = await reconciliations.$post({
      param: { exchangeId: "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d" },
      json: {
        id: "e9a1c3d5-6f8b-4a0c-b2e4-5f7b9c1d3e6a",
        connector_id: "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15",
        assertion: { ...assertion, payload_digest: digestA },
        local_version: "9",
        items: [{ key: "record:1", local_digest: digestA, external_digest: digestA }],
      },
    })
    expect(Number(overwritten.status)).toBe(409)

    const listed = await reconciliations.$get({
      param: { exchangeId: "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d" },
    })
    expect(listed.status).toBe(200)
    expect(await listed.json()).toMatchObject({
      reconciliations: [
        {
          id: "d8f0b2c4-5e7a-4f9b-a1d3-4e6a8b0c2d5f",
          assertion_id: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
          local_version: "8",
          status: "matched",
        },
        {
          id: "c7e9a1b3-4d6f-4e8a-b0c2-3d5f7a9b1c4e",
          assertion_id: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
          local_version: "7",
          status: "mismatched",
        },
      ],
    })
    expect(await assertionRows(fixture)).toEqual(assertionsAfterFirst)
    expect(
      await fixture.database
        .prepare(`SELECT
             (SELECT count(*) FROM system_reconciliation_runs) AS runs,
             (SELECT count(*) FROM system_reconciliation_items) AS items,
             (SELECT count(*) FROM system_audit_events
               WHERE action = 'system.integration_reconciliation.recorded') AS audits`)
        .first<Record<string, unknown>>(),
    ).toEqual({ runs: 2, items: 2, audits: 2 })
  })
})

async function seedAuthorization(fixture: SystemSessionTestContext, now: Date): Promise<void> {
  await fixture.database
    .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`)
    .bind(accountId, now.getTime())
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`)
    .bind(scopedAccountId, now.getTime())
    .run()
  await execSql(
    fixture.database,
    `INSERT INTO system_iam_roles
       (id, key, kind, name, created_at, updated_at)
     VALUES ('64965518-94f7-440b-87d6-5f01de16a196', 'system:integration', 'managed', 'Integration', 1, 1);
     INSERT INTO system_iam_role_permissions (role_id, permission_key)
     VALUES ('64965518-94f7-440b-87d6-5f01de16a196', 'integration:read'), ('64965518-94f7-440b-87d6-5f01de16a196', 'integration:write');
     INSERT INTO system_role_bindings
       (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
     VALUES ('e8756177-3dce-4eae-8c24-31bd4fff3dca', '0f6cc3a9-017b-4583-bd3c-b5d9c9957a67', '64965518-94f7-440b-87d6-5f01de16a196', NULL, NULL, 1, NULL);
     INSERT INTO system_iam_roles
       (id, key, kind, resource_type, name, created_at, updated_at)
     VALUES ('1d6b0d20-37d4-4ff5-8a67-96df56cb1a57', 'system:scoped-integration', 'custom',
             'system:connector', 'Scoped integration', 1, 1);
     INSERT INTO system_iam_role_permissions (role_id, permission_key)
     VALUES ('1d6b0d20-37d4-4ff5-8a67-96df56cb1a57', 'integration:read'),
            ('1d6b0d20-37d4-4ff5-8a67-96df56cb1a57', 'integration:write');
     INSERT INTO system_role_bindings
       (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
     VALUES ('0613ddf2-ccf9-4eee-8a22-f81759d2043a', 'ddb2961e-afa3-4c3b-b707-060e04ee69c5',
             '1d6b0d20-37d4-4ff5-8a67-96df56cb1a57', 'system:connector', '6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15', 1, NULL);`,
  )
}

async function seedExchange(fixture: SystemSessionTestContext): Promise<void> {
  await execSql(
    fixture.database,
    `INSERT INTO system_connectors
       (id, key, name, direction, transport, status, revision, created_at, updated_at)
     VALUES ('6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15', 'generic', 'Generic', 'bidirectional', 'api', 'active', 1, 1, 1);
     INSERT INTO system_integration_exchanges
       (id, connector_id, direction, operation_key, idempotency_key, payload_digest, status,
        attempt, external_reference, last_error_code, created_at, updated_at, completed_at)
     VALUES ('b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d', '6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15', 'outbound', 'record.export', 'command:1',
             '${digestA}', 'pending', 1, NULL, NULL, 1, 1, NULL);`,
  )
}

async function assertionRows(
  fixture: SystemSessionTestContext,
): Promise<ReadonlyArray<Record<string, unknown>>> {
  const rows = await fixture.database
    .prepare("SELECT * FROM system_external_assertions ORDER BY id")
    .all<Record<string, unknown>>()
  return rows.results
}

async function issueSession(
  fixture: SystemSessionTestContext,
  requestedAccountId: typeof accountId,
) {
  const applications = createSystemSessionApplications({
    context: fixture.context,
    jwtSecret: "system-session-test-jwt-secret",
    sessionTtlMilliseconds: 604_800_000,
  })
  if (applications instanceof Error) throw applications
  return requireIssuedSystemSession(
    await applications.issue.execute({
      accountId: requestedAccountId,
      tokenVersion: 0,
      now: new Date(),
      auditContext: { authorizationJson: null, metadataJson: null },
    }),
  )
}

function connectorInput(): {
  id: string
  key: string
  name: string
  direction: "bidirectional"
  transport: "api"
} {
  return {
    id: "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15",
    key: "generic",
    name: "Generic",
    direction: "bidirectional",
    transport: "api",
  }
}

function exchangeInput(id: string): {
  id: string
  connector_id: string
  direction: "outbound"
  operation_key: string
  idempotency_key: string
  payload_digest: string
} {
  return {
    id,
    connector_id: "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15",
    direction: "outbound",
    operation_key: "record.export",
    idempotency_key: "command:1",
    payload_digest: digestA,
  }
}

async function seedConnectorMachine(
  fixture: SystemSessionTestContext,
  now: Date,
): Promise<Readonly<{ credential_id: string; secret: string }>> {
  const secret = "2".repeat(64)
  const secretHash = await new SystemPrincipalSecretService().hashRawSecret(secret)
  if (secretHash instanceof Error) throw secretHash
  await execSql(
    fixture.database,
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
     VALUES ('273f37ff-0810-4afe-ac1e-fb6dfeae40c7', 'active', 0, ${now.getTime()}, ${now.getTime()});
     INSERT INTO system_principals
       (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
     VALUES ('94f3adc1-5bf4-40c9-8b24-dd3bbc3ff8e9', '273f37ff-0810-4afe-ac1e-fb6dfeae40c7', 'connector',
             'Connector machine', '6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15', 1, ${now.getTime()}, ${now.getTime()});`,
  )
  await fixture.database
    .prepare(`INSERT INTO system_machine_credentials
         (id, principal_id, name, secret_hash, status, created_at, updated_at,
          expires_at, last_used_at, revoked_at)
       VALUES ('d186abc8-6d6e-4835-aaa8-55bbc51dcd41', '94f3adc1-5bf4-40c9-8b24-dd3bbc3ff8e9', 'Primary', ?1, 'active',
               ?2, ?2, NULL, NULL, NULL)`)
    .bind(secretHash, now.getTime())
    .run()
  return { credential_id: "d186abc8-6d6e-4835-aaa8-55bbc51dcd41", secret }
}
