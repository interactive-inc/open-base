import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { systemFactory } from "@system/interface/request-environment/system-factory"
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
    if (session instanceof Error || session.kind === "rejected") return

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
      json: exchangeInput("exchange:1"),
    })
    expect(exchange.status).toBe(201)
    const replay = await client.system["integration-exchanges"].$post({
      json: exchangeInput("exchange:replay"),
    })
    expect(replay.status).toBe(200)

    clock.value = new Date(clock.value.getTime() + 1_000)
    const failed = await client.system["integration-exchanges"][":exchangeId"].$patch({
      param: { exchangeId: "exchange:1" },
      json: { status: "failed", external_reference: null, error_code: "remote.unavailable" },
    })
    expect(failed.status).toBe(200)
    clock.value = new Date(clock.value.getTime() + 1_000)
    const retried = await client.system["integration-exchanges"][":exchangeId"].$patch({
      param: { exchangeId: "exchange:1" },
      json: { status: "pending", external_reference: null, error_code: null },
    })
    expect(retried.status).toBe(200)

    const reconciled = await client.system["integration-exchanges"][
      ":exchangeId"
    ].reconciliations.$post({
      param: { exchangeId: "exchange:1" },
      json: {
        id: "reconciliation:1",
        connector_id: "connector:1",
        assertion: {
          id: "assertion:1",
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
    const listed = await client.system["integration-exchanges"][":exchangeId"].reconciliations.$get(
      {
        param: { exchangeId: "exchange:1" },
      },
    )
    expect(listed.status).toBe(200)
    expect(await listed.json()).toMatchObject({
      reconciliations: [{ status: "mismatched", item_count: 1 }],
    })
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
    if (scopedSession instanceof Error || scopedSession.kind === "rejected") return
    const scopedClient = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: { authorization: `Bearer ${scopedSession.accessToken}` },
    })
    expect(
      (
        await scopedClient.system["integration-exchanges"].$get({
          query: { connector_id: "connector:1" },
        })
      ).status,
    ).toBe(200)
    const denied = await scopedClient.system["integration-exchanges"].$get({
      query: { connector_id: "connector:other" },
    })
    expect(Number(denied.status)).toBe(403)

    clock.value = new Date(clock.value.getTime() + 1_000)
    const disabled = await client.system.connectors[":connectorId"].$patch({
      param: { connectorId: "connector:1" },
      json: {
        name: "Generic",
        status: "disabled",
        expected_revision: 1,
        reason: "maintenance",
      },
    })
    expect(disabled.status).toBe(200)
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
             '1d6b0d20-37d4-4ff5-8a67-96df56cb1a57', 'system:connector', 'connector:1', 1, NULL);`,
  )
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
  if (applications instanceof Error) return applications
  return applications.issue.execute({
    accountId: requestedAccountId,
    tokenVersion: 0,
    now: new Date(),
    auditContext: { authorizationJson: null, metadataJson: null },
  })
}

function connectorInput() {
  return {
    id: "connector:1",
    key: "generic",
    name: "Generic",
    direction: "bidirectional" as const,
    transport: "api" as const,
  }
}

function exchangeInput(id: string) {
  return {
    id,
    connector_id: "connector:1",
    direction: "outbound" as const,
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
             'Connector machine', 'connector:1', 1, ${now.getTime()}, ${now.getTime()});`,
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
