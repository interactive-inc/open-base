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
    if (accessToken instanceof Error) return
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
})

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
  const applications = createSystemSessionApplications({
    context: fixture.context,
    jwtSecret,
    sessionTtlMilliseconds: 604_800_000,
  })
  if (applications instanceof Error) return applications
  const result = await applications.issue.execute({
    accountId: rootAccountId,
    tokenVersion: 0,
    now: new Date(),
    auditContext: { authorizationJson: null, metadataJson: null },
  })
  if (result instanceof Error || result.kind === "rejected") {
    return result instanceof Error ? result : new Error(result.reason)
  }
  return result.accessToken
}
