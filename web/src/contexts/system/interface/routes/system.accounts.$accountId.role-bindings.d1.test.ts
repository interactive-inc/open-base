import { testAccountId } from "@system/test/system-test-id.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { seedSystemStepUpGrant } from "@system/test/seed-system-step-up-grant.test-support"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { DELETE } from "@system/interface/routes/system.accounts.$accountId.role-bindings.$bindingId"
import { GET, POST } from "@system/interface/routes/system.accounts.$accountId.role-bindings"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")
const rootAccountId = zAccountId.parse(testAccountId("system-binding-root"))
const targetAccountId = zAccountId.parse(testAccountId("3ae2c1d9-f704-4381-a719-3333265bb9e4"))

describe("System Role Binding HTTP", () => {
  test("付与・一覧・失効・自己付与拒否・自己失効拒否をSystemだけで完結する", async () => {
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
         VALUES ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'system:root', 'managed', 'System root', NULL, ?1, ?1),
                ('04635707-bd54-47ea-81d4-38426e3ce8a2', 'example:reader', 'custom', 'Example reader', NULL, ?1, ?1)`)
      .bind(now.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'iam:read'),
                ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'iam:write'),
                ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'system:admin'),
                ('04635707-bd54-47ea-81d4-38426e3ce8a2', 'example:read')`)
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
      .get("/system/accounts/:accountId/role-bindings", ...GET)
      .post("/system/accounts/:accountId/role-bindings", ...POST)
      .delete("/system/accounts/:accountId/role-bindings/:bindingId", ...DELETE)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: "system-session-test-jwt-secret",
      })
    const client = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: {
        authorization: `Bearer ${issuance.accessToken}`,
        "x-system-step-up": stepUpToken,
      },
    })

    const created = await client.system.accounts[":accountId"]["role-bindings"].$post({
      param: { accountId: targetAccountId },
      json: { role_id: "04635707-bd54-47ea-81d4-38426e3ce8a2", resource: null },
    })
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect("id" in createdBody).toBe(true)
    if (!("id" in createdBody)) return
    expect(createdBody).toMatchObject({
      account_id: targetAccountId,
      role_id: "04635707-bd54-47ea-81d4-38426e3ce8a2",
    })
    expect(
      await fixture.database
        .prepare("SELECT token_version FROM system_accounts WHERE id = ?1")
        .bind(targetAccountId)
        .first<Record<string, unknown>>(),
    ).toEqual({ token_version: 1 })

    const listed = await client.system.accounts[":accountId"]["role-bindings"].$get({
      param: { accountId: targetAccountId },
    })
    expect(listed.status).toBe(200)
    const listedBody = await listed.json()
    expect("total" in listedBody).toBe(true)
    if (!("total" in listedBody)) return
    expect(listedBody.total).toBe(1)

    const selfAssignment = await client.system.accounts[":accountId"]["role-bindings"].$post({
      param: { accountId: rootAccountId },
      json: { role_id: "04635707-bd54-47ea-81d4-38426e3ce8a2", resource: null },
    })
    expect(Number(selfAssignment.status)).toBe(403)

    const selfRevocation = await client.system.accounts[":accountId"]["role-bindings"][
      ":bindingId"
    ].$delete({
      param: { accountId: rootAccountId, bindingId: "f16b950f-c6db-4760-8994-95cc8065169d" },
    })
    expect(Number(selfRevocation.status)).toBe(403)

    const revoked = await client.system.accounts[":accountId"]["role-bindings"][
      ":bindingId"
    ].$delete({
      param: { accountId: targetAccountId, bindingId: createdBody.id },
    })
    expect(revoked.status).toBe(204)
    expect(
      await fixture.database
        .prepare("SELECT token_version FROM system_accounts WHERE id = ?1")
        .bind(targetAccountId)
        .first<Record<string, unknown>>(),
    ).toEqual({ token_version: 2 })
    expect(
      await fixture.database
        .prepare(`SELECT count(*) AS total
           FROM system_audit_events
           WHERE action LIKE 'system.iam.role_binding.%'`)
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 2 })
  })
})
