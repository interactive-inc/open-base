import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { POST as machineSessionPOST } from "@system/interface/routes/system.machine-sessions"
import { DELETE as credentialDELETE } from "@system/interface/routes/system.principals.$principalId.machine-credentials.$credentialId"
import {
  GET as credentialsGET,
  POST as credentialsPOST,
} from "@system/interface/routes/system.principals.$principalId.machine-credentials"
import {
  GET as principalsGET,
  POST as principalsPOST,
} from "@system/interface/routes/system.principals"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")
const rootAccountId = zAccountId.parse("06b683a4-a91c-4b76-af75-d34d402f0ac6")
const jwtSecret = "system-session-test-jwt-secret"

describe("System Principal HTTP", () => {
  test("step-up後にAgentとcredentialを作り、機械token発行後もraw secretを保存しない", async () => {
    const fixture = await SystemSessionTestContext.create()
    await seedRoot(fixture)
    const accessToken = await issueRootAccessToken(fixture)
    if (accessToken instanceof Error) throw accessToken
    const rawStepUp = "1".repeat(64)
    const stepUpHash = await new SystemPrincipalSecretService().hashRawSecret(rawStepUp)
    expect(stepUpHash).not.toBeInstanceOf(Error)
    if (stepUpHash instanceof Error) return
    await fixture.database
      .prepare(`INSERT INTO system_step_up_grants
           (id, account_id, token_hash, method, issued_at, expires_at, last_used_at, revoked_at)
         VALUES ('5e32da6a-cdd9-4fcf-b973-b80082165594', ?1, ?2, 'password', ?3, ?4, NULL, NULL)`)
      .bind(rootAccountId, stepUpHash, now.getTime(), now.getTime() + 300_000)
      .run()

    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("now", () => now)
        await next()
      })
      .get("/system/principals", ...principalsGET)
      .post("/system/principals", ...principalsPOST)
      .get("/system/principals/:principalId/machine-credentials", ...credentialsGET)
      .post("/system/principals/:principalId/machine-credentials", ...credentialsPOST)
      .delete(
        "/system/principals/:principalId/machine-credentials/:credentialId",
        ...credentialDELETE,
      )
      .post("/system/machine-sessions", ...machineSessionPOST)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: jwtSecret,
        NOW: now.toISOString(),
      })
    const client = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-system-step-up": rawStepUp,
      },
    })

    const createdPrincipal = await client.system.principals.$post({
      json: { kind: "agent", name: "Automation agent" },
    })
    expect(createdPrincipal.status).toBe(201)
    const principalBody = await createdPrincipal.json()
    expect("principal" in principalBody).toBe(true)
    if (!("principal" in principalBody)) return

    const createdCredential = await client.system.principals[":principalId"][
      "machine-credentials"
    ].$post({
      param: { principalId: principalBody.principal.id },
      json: { name: "Primary", expires_at: null, reason: "initial provisioning" },
    })
    expect(createdCredential.status).toBe(201)
    const credentialBody = await createdCredential.json()
    expect("credential" in credentialBody && "secret" in credentialBody).toBe(true)
    if (!("credential" in credentialBody) || !("secret" in credentialBody)) return
    expect(
      await fixture.database
        .prepare("SELECT secret_hash FROM system_machine_credentials WHERE id = ?1")
        .bind(credentialBody.credential.id)
        .first<Record<string, unknown>>(),
    ).not.toEqual({ secret_hash: credentialBody.secret })

    const machineSession = await app.request(
      "/system/machine-sessions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          credential_id: credentialBody.credential.id,
          secret: credentialBody.secret,
        }),
      },
      { DB: fixture.context.env.DB, JWT_SECRET: jwtSecret, NOW: now.toISOString() },
    )
    expect(machineSession.status).toBe(201)
    expect(await machineSession.json()).toMatchObject({
      account_id: principalBody.principal.account_id,
      token_type: "Bearer",
    })
    expect(
      await fixture.database
        .prepare("SELECT last_used_at FROM system_machine_credentials WHERE id = ?1")
        .bind(credentialBody.credential.id)
        .first<Record<string, unknown>>(),
    ).toEqual({ last_used_at: now.getTime() })

    const revoked = await client.system.principals[":principalId"]["machine-credentials"][
      ":credentialId"
    ].$delete({
      param: {
        principalId: principalBody.principal.id,
        credentialId: credentialBody.credential.id,
      },
      json: { reason: "rotation" },
    })
    expect(revoked.status).toBe(204)
    expect(
      await fixture.database
        .prepare(`SELECT count(*) AS total FROM system_audit_events
           WHERE action IN (
             'system.principal.created',
             'auth.machine_credential.created',
             'auth.machine_token.issued',
             'auth.machine_credential.revoked'
           )`)
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 4 })
  })

  test("iam:writeだけの操作者は、自分にない権限を持つPrincipalへcredentialを追加できない", async () => {
    const fixture = await SystemSessionTestContext.create()
    await seedRoot(fixture)
    await execSql(
      fixture.database,
      `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES ('${operatorAccountId}', 'active', 0, 1, 1),
              ('${serviceAccountId}', 'active', 0, 1, 1),
              ('${agentAccountId}', 'active', 0, 1, 1);
       INSERT INTO system_principals
         (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
       VALUES ('${servicePrincipalId}', '${serviceAccountId}', 'service', 'Integration service', NULL, 1, 1, 1),
              ('${agentPrincipalId}', '${agentAccountId}', 'agent', 'Reader agent', NULL, 1, 1, 1);
       INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
       VALUES ('c2a1b6a2-2222-4222-8222-222222222222', 'test:iam-operator', 'custom', 'IAM operator', 1, 1),
              ('d3a1b6a2-3333-4333-8333-333333333333', 'test:integration-writer', 'custom', 'Integration writer', 1, 1);
       INSERT INTO system_iam_role_permissions (role_id, permission_key)
       VALUES ('c2a1b6a2-2222-4222-8222-222222222222', 'iam:read'),
              ('c2a1b6a2-2222-4222-8222-222222222222', 'iam:write'),
              ('d3a1b6a2-3333-4333-8333-333333333333', 'integration:write');
       INSERT INTO system_role_bindings
         (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
       VALUES ('c3a1b6a2-3333-4333-8333-333333333333', '${operatorAccountId}', 'c2a1b6a2-2222-4222-8222-222222222222', NULL, NULL, 1, NULL),
              ('d4a1b6a2-4444-4444-8444-444444444444', '${serviceAccountId}', 'd3a1b6a2-3333-4333-8333-333333333333', NULL, NULL, 1, NULL),
              ('e4a1b6a2-4444-4444-8444-444444444444', '${agentAccountId}', 'c2a1b6a2-2222-4222-8222-222222222222', NULL, NULL, 1, NULL);`,
    )
    const operator = await createCredentialClient(fixture, operatorAccountId)
    const root = await createCredentialClient(fixture, rootAccountId)
    if (operator instanceof Error) throw operator
    if (root instanceof Error) throw root
    // 403はhandlerが例外で返すためclientの型に現れない。状態コードは数値で比べる。
    const issue = async (client: CredentialClient, principalId: string): Promise<number> => {
      const response = await client.system.principals[":principalId"]["machine-credentials"].$post({
        param: { principalId },
        json: { name: "Primary", expires_at: null, reason: "provisioning" },
      })
      return Number(response.status)
    }
    const countCreated = async () =>
      await fixture.database
        .prepare(`SELECT
             (SELECT count(*) FROM system_machine_credentials) AS credentials,
             (SELECT count(*) FROM system_audit_events
              WHERE action = 'auth.machine_credential.created') AS audits`)
        .first<Record<string, unknown>>()

    expect(await issue(operator, servicePrincipalId)).toBe(403)
    expect(await countCreated()).toEqual({ credentials: 0, audits: 0 })

    expect(await issue(operator, agentPrincipalId)).toBe(201)
    expect(await countCreated()).toEqual({ credentials: 1, audits: 1 })

    // 対象が後から操作者にない権限を得たら、同じ操作者はもう追加できない。
    await fixture.database
      .prepare(`INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES ('e5a1b6a2-5555-4555-8555-555555555555', ?1,
                 'd3a1b6a2-3333-4333-8333-333333333333', 'facility', 'f1', 2, NULL)`)
      .bind(agentAccountId)
      .run()
    expect(await issue(operator, agentPrincipalId)).toBe(403)
    expect(await countCreated()).toEqual({ credentials: 1, audits: 1 })

    expect(await issue(root, servicePrincipalId)).toBe(201)
    expect(await countCreated()).toEqual({ credentials: 2, audits: 2 })
  })
})

const operatorAccountId = zAccountId.parse("c1a1b6a2-1111-4111-8111-111111111111")
const serviceAccountId = zAccountId.parse("d1a1b6a2-1111-4111-8111-111111111111")
const servicePrincipalId = "d2a1b6a2-2222-4222-8222-222222222222"
const agentAccountId = zAccountId.parse("e1a1b6a2-1111-4111-8111-111111111111")
const agentPrincipalId = "e2a1b6a2-2222-4222-8222-222222222222"

function createCredentialApp() {
  return systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => now)
      await next()
    })
    .post("/system/principals/:principalId/machine-credentials", ...credentialsPOST)
}

type CredentialClient = ReturnType<typeof hc<ReturnType<typeof createCredentialApp>>>

async function createCredentialClient(
  fixture: SystemSessionTestContext,
  accountId: typeof rootAccountId,
): Promise<CredentialClient | Error> {
  const accessToken = await issueAccessToken(fixture, accountId)
  if (accessToken instanceof Error) return accessToken
  const rawStepUp = crypto.randomUUID().replaceAll("-", "").repeat(2)
  const stepUpHash = await new SystemPrincipalSecretService().hashRawSecret(rawStepUp)
  if (stepUpHash instanceof Error) return stepUpHash
  await fixture.database
    .prepare(`INSERT INTO system_step_up_grants
         (id, account_id, token_hash, method, issued_at, expires_at, last_used_at, revoked_at)
       VALUES (?1, ?2, ?3, 'password', ?4, ?5, NULL, NULL)`)
    .bind(crypto.randomUUID(), accountId, stepUpHash, now.getTime(), now.getTime() + 300_000)
    .run()
  const app = createCredentialApp()

  return hc<typeof app>("http://system.test", {
    fetch: (input: Parameters<typeof app.request>[0], init?: Parameters<typeof app.request>[1]) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: jwtSecret,
        NOW: now.toISOString(),
      }),
    headers: { authorization: `Bearer ${accessToken}`, "x-system-step-up": rawStepUp },
  })
}

async function seedRoot(fixture: SystemSessionTestContext): Promise<void> {
  await fixture.database
    .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`)
    .bind(rootAccountId, now.getTime())
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_principals
         (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
       VALUES ('4d0f979a-6d3b-4d7b-9be0-fe4b3a99e1d2', ?1, 'human', 'Root', NULL, 1, ?2, ?2)`)
    .bind(rootAccountId, now.getTime())
    .run()
  await execSql(
    fixture.database,
    `INSERT INTO system_iam_roles
       (id, key, kind, name, created_at, updated_at)
     VALUES ('7fc6245e-9a8a-419a-849e-d398ffef5c52', 'system:root', 'managed', 'System root', 1, 1);
     INSERT INTO system_iam_role_permissions (role_id, permission_key)
     VALUES ('7fc6245e-9a8a-419a-849e-d398ffef5c52', 'iam:read'),
            ('7fc6245e-9a8a-419a-849e-d398ffef5c52', 'iam:write'),
            ('7fc6245e-9a8a-419a-849e-d398ffef5c52', 'system:admin');
     INSERT INTO system_role_bindings
       (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
     VALUES ('a0fa7364-472e-45da-8939-f513091033e4', '06b683a4-a91c-4b76-af75-d34d402f0ac6', '7fc6245e-9a8a-419a-849e-d398ffef5c52',
             NULL, NULL, 1, NULL);`,
  )
}

async function issueRootAccessToken(fixture: SystemSessionTestContext): Promise<string | Error> {
  return await issueAccessToken(fixture, rootAccountId)
}

async function issueAccessToken(
  fixture: SystemSessionTestContext,
  accountId: typeof rootAccountId,
): Promise<string | Error> {
  const applications = createSystemSessionApplications({
    context: fixture.context,
    jwtSecret,
    sessionTtlMilliseconds: 604_800_000,
  })
  if (applications instanceof Error) return applications
  const result = await applications.issue.execute({
    accountId,
    tokenVersion: 0,
    now: new Date(),
    auditContext: { authorizationJson: null, metadataJson: null },
  })
  if (result instanceof Error || result.kind === "rejected") {
    return result instanceof Error ? result : new Error(result.reason)
  }
  return result.accessToken
}
