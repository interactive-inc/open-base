import { testAccountId } from "@system/test/system-test-id.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { seedSystemStepUpGrant } from "@system/test/seed-system-step-up-grant.test-support"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import {
  DELETE,
  GET as GET_ONE,
} from "@system/interface/routes/system.accounts.$accountId.identities.$identityId"
import {
  GET as GET_MANY,
  POST,
} from "@system/interface/routes/system.accounts.$accountId.identities"
import { PATCH as RESET_PASSWORD } from "@system/interface/routes/system.accounts.$accountId.password-credentials"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")
const rootAccountId = zAccountId.parse(testAccountId("system-identity-root"))
const targetAccountId = zAccountId.parse(testAccountId("f8d6fd4f-d8aa-47c6-9c19-d77346485329"))

describe("System Identity HTTP", () => {
  test("外部・password Identityの作成・参照・失効とlast-activeをSystemだけで完結する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await fixture.database
      .prepare(`INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?3, ?3), (?2, 'active', 0, ?3, ?3)`)
      .bind(rootAccountId, targetAccountId, now.getTime())
      .run()
    const stepUpToken = await seedSystemStepUpGrant(fixture, rootAccountId, now)
    await fixture.database
      .prepare(`INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at, revoked_at)
         VALUES ('ac7f571e-ae97-4159-85e1-ba9cf4928de8', ?1, 'password', 'root@example.com', ?2, ?2, NULL)`)
      .bind(rootAccountId, now.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_iam_roles
           (id, key, kind, name, description, created_at, updated_at)
         VALUES ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'system:root', 'managed', 'System root', NULL, ?1, ?1)`)
      .bind(now.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'iam:read'),
                ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'iam:write'),
                ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'system:admin')`)
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES ('f16b950f-c6db-4760-8994-95cc8065169d', ?1, 'af285551-000d-4320-8ea0-bbfbc6c96a81', NULL, NULL, ?2, NULL)`)
      .bind(rootAccountId, now.getTime())
      .run()

    const applications = createSystemSessionApplications({
      context: fixture.context,
      jwtSecret: "system-session-test-jwt-secret",
      sessionTtlMilliseconds: 604_800_000,
    })
    expect(applications).not.toBeInstanceOf(Error)
    if (applications instanceof Error) return
    const issuance = await applications.issue.execute({
      accountId: rootAccountId,
      tokenVersion: 0,
      now: new Date(),
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    expect(issuance).not.toBeInstanceOf(Error)
    if (issuance instanceof Error || issuance.kind === "rejected") return

    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("now", () => now)
        await next()
      })
      .get("/system/accounts/:accountId/identities", ...GET_MANY)
      .post("/system/accounts/:accountId/identities", ...POST)
      .get("/system/accounts/:accountId/identities/:identityId", ...GET_ONE)
      .delete("/system/accounts/:accountId/identities/:identityId", ...DELETE)
      .patch("/system/accounts/:accountId/password-credentials", ...RESET_PASSWORD)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: "system-session-test-jwt-secret",
        PEPPER_SECRET: "system-identity-test-pepper",
      })
    const client = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: {
        authorization: `Bearer ${issuance.accessToken}`,
        "x-system-step-up": stepUpToken,
      },
    })

    const external = await client.system.accounts[":accountId"].identities.$post({
      param: { accountId: targetAccountId },
      json: {
        provider: "oidc",
        subject: "external-subject-1",
        email: "external@example.com",
        email_verified: true,
      },
    })
    expect(external.status).toBe(201)
    const externalBody = await external.json()
    expect("id" in externalBody).toBe(true)
    if (!("id" in externalBody)) return

    const password = await client.system.accounts[":accountId"].identities.$post({
      param: { accountId: targetAccountId },
      json: {
        provider: "password",
        email: "target@example.com",
        password: "correct horse battery staple",
      },
    })
    expect(password.status).toBe(201)
    const passwordBody = await password.json()
    expect("id" in passwordBody).toBe(true)
    if (!("id" in passwordBody)) return
    expect(
      await fixture.database
        .prepare("SELECT count(*) AS total FROM system_password_credentials")
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 1 })
    const passwordHashBefore = await fixture.database
      .prepare("SELECT password_hash FROM system_password_credentials WHERE identity_id = ?1")
      .bind(passwordBody.id)
      .first<Record<string, unknown>>()
    const passwordReset = await client.system.accounts[":accountId"]["password-credentials"].$patch(
      {
        param: { accountId: targetAccountId },
        json: { password: "another correct horse battery staple" },
      },
    )
    expect(passwordReset.status).toBe(204)
    expect(
      await fixture.database
        .prepare("SELECT password_hash FROM system_password_credentials WHERE identity_id = ?1")
        .bind(passwordBody.id)
        .first<Record<string, unknown>>(),
    ).not.toEqual(passwordHashBefore)

    const listed = await client.system.accounts[":accountId"].identities.$get({
      param: { accountId: targetAccountId },
    })
    expect(listed.status).toBe(200)
    const listedBody = await listed.json()
    expect("total" in listedBody).toBe(true)
    if (!("total" in listedBody)) return
    expect(listedBody.total).toBe(2)

    const detailed = await client.system.accounts[":accountId"].identities[":identityId"].$get({
      param: { accountId: targetAccountId, identityId: passwordBody.id },
    })
    expect(detailed.status).toBe(200)
    expect(await detailed.json()).toMatchObject({ provider: "password", state: "active" })

    const revoked = await client.system.accounts[":accountId"].identities[":identityId"].$delete({
      param: { accountId: targetAccountId, identityId: externalBody.id },
    })
    expect(revoked.status).toBe(204)

    const lastActive = await client.system.accounts[":accountId"].identities[":identityId"].$delete(
      {
        param: { accountId: targetAccountId, identityId: passwordBody.id },
      },
    )
    expect(Number(lastActive.status)).toBe(409)
    expect(
      await fixture.database
        .prepare("SELECT token_version FROM system_accounts WHERE id = ?1")
        .bind(targetAccountId)
        .first<Record<string, unknown>>(),
    ).toEqual({ token_version: 4 })
    expect(
      await fixture.database
        .prepare(`SELECT count(*) AS total
           FROM system_audit_events
           WHERE action LIKE 'system.identity.%'`)
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 3 })
    expect(
      await fixture.database
        .prepare(`SELECT count(*) AS total
           FROM system_audit_events
           WHERE action = 'system.password_credential.reset'`)
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 1 })
  })
})
