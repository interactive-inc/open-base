import { testAccountId } from "@system/test/system-test-id.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { requireIssuedSystemSession } from "@system/test/require-issued-system-session.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { seedSystemStepUpGrant } from "@system/test/seed-system-step-up-grant.test-support"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { SystemAccountCatalogRepository } from "@system/infrastructure/repositories/iam/system-account-catalog.repository"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { GET as GET_ONE, PATCH } from "@system/interface/routes/system.accounts.$accountId"
import { GET as GET_MANY, POST } from "@system/interface/routes/system.accounts"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")
const rootAccountId = zAccountId.parse(testAccountId("system-root-account"))
const delegatedAdministratorAccountId = zAccountId.parse(
  testAccountId("delegated-administrator-account"),
)
const scopedPrivilegedAccountId = zAccountId.parse(testAccountId("scoped-privileged-account"))

describe("System AccountEntity HTTP", () => {
  test("AccountEntity作成・一覧・詳細・失効と自己停止拒否をSystemだけで完結する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await fixture.database
      .prepare(`INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`)
      .bind(rootAccountId, now.getTime())
      .run()
    const rootStepUpToken = await seedSystemStepUpGrant(fixture, rootAccountId, now)
    await fixture.database
      .prepare(`INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at, revoked_at)
         VALUES ('ac7f571e-ae97-4159-85e1-ba9cf4928de8', ?1, 'password', 'root@example.com', ?2, ?2, NULL)`)
      .bind(rootAccountId, now.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_iam_roles
           (id, key, kind, name, created_at, updated_at)
         VALUES ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'system:root', 'managed', 'System root', ?1, ?1)`)
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
    const issuance = requireIssuedSystemSession(
      await applications.issue.execute({
        accountId: rootAccountId,
        tokenVersion: 0,
        now: new Date(),
        auditContext: { authorizationJson: null, metadataJson: null },
      }),
    )

    const clock = { now }
    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("now", () => clock.now)
        await next()
      })
      .get("/system/accounts", ...GET_MANY)
      .post("/system/accounts", ...POST)
      .get("/system/accounts/:accountId", ...GET_ONE)
      .patch("/system/accounts/:accountId", ...PATCH)
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
        "x-system-step-up": rootStepUpToken,
      },
    })
    const unsteppedClient = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: { authorization: `Bearer ${issuance.accessToken}` },
    })
    expect(Number((await unsteppedClient.system.accounts.$post()).status)).toBe(403)

    const created = await client.system.accounts.$post()
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect("id" in createdBody).toBe(true)
    if (!("id" in createdBody)) return
    expect(createdBody.status).toBe("active")
    expect(createdBody.role_keys).toEqual([])

    const listed = await client.system.accounts.$get()
    expect(listed.status).toBe(200)
    const listedBody = await listed.json()
    expect("total" in listedBody).toBe(true)
    if (!("total" in listedBody)) return
    expect(listedBody.total).toBe(2)

    const detailed = await client.system.accounts[":accountId"].$get({
      param: { accountId: createdBody.id },
    })
    expect(detailed.status).toBe(200)
    expect(await detailed.json()).toMatchObject({ id: createdBody.id, token_version: 0 })

    const suspended = await client.system.accounts[":accountId"].$patch({
      param: { accountId: createdBody.id },
      json: { status: "suspended" },
    })
    expect(suspended.status).toBe(200)
    expect(await suspended.json()).toMatchObject({ status: "suspended", token_version: 1 })
    expect(
      await fixture.database
        .prepare(
          "SELECT before_json, after_json FROM system_audit_events WHERE target_id = ?1 AND action = 'system.account.status_updated'",
        )
        .bind(createdBody.id)
        .first<Record<string, unknown>>(),
    ).toEqual({
      before_json: '{"status":"active","token_version":0}',
      after_json: '{"status":"suspended","token_version":1}',
    })

    const selfSuspension = await client.system.accounts[":accountId"].$patch({
      param: { accountId: rootAccountId },
      json: { status: "suspended" },
    })
    expect(Number(selfSuspension.status)).toBe(403)
    expect(
      await fixture.database
        .prepare(`SELECT count(*) AS total
           FROM system_audit_events
           WHERE action IN ('system.account.created', 'system.account.status_updated')`)
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 2 })

    const concurrent = await client.system.accounts.$post()
    expect(concurrent.status).toBe(201)
    const concurrentBody = await concurrent.json()
    expect("id" in concurrentBody).toBe(true)
    if (!("id" in concurrentBody)) return

    const find = SystemAccountCatalogRepository.prototype.find
    const interleaved = spyOn(
      SystemAccountCatalogRepository.prototype,
      "find",
    ).mockImplementationOnce(async function (this: SystemAccountCatalogRepository, accountId) {
      const snapshot = await find.call(this, accountId)
      expect(snapshot).toMatchObject({ id: concurrentBody.id, status: "active", tokenVersion: 0 })
      clock.now = new Date(now.getTime() + 1000)
      const locked = await client.system.accounts[":accountId"].$patch({
        param: { accountId: concurrentBody.id },
        json: { status: "locked" },
      })
      expect(locked.status).toBe(200)
      expect(await locked.json()).toMatchObject({ status: "locked", token_version: 1 })
      clock.now = new Date(now.getTime() + 2000)
      return snapshot
    })
    try {
      const staleSuspension = await client.system.accounts[":accountId"].$patch({
        param: { accountId: concurrentBody.id },
        json: { status: "suspended" },
      })
      expect(Number(staleSuspension.status)).toBe(409)
      expect(interleaved).toHaveBeenCalled()
    } finally {
      interleaved.mockRestore()
    }
    expect(
      await fixture.database
        .prepare("SELECT status, token_version, updated_at FROM system_accounts WHERE id = ?1")
        .bind(concurrentBody.id)
        .first<Record<string, unknown>>(),
    ).toEqual({ status: "locked", token_version: 1, updated_at: now.getTime() + 1000 })
    expect(
      (
        await fixture.database
          .prepare(
            "SELECT before_json, after_json FROM system_audit_events WHERE target_id = ?1 AND action = 'system.account.status_updated'",
          )
          .bind(concurrentBody.id)
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([
      {
        before_json: '{"status":"active","token_version":0}',
        after_json: '{"status":"locked","token_version":1}',
      },
    ])

    const auditFailure = spyOn(
      SystemAuditEventRepository.prototype,
      "prepareAppend",
    ).mockImplementationOnce(() => [
      fixture.database.prepare("SELECT * FROM missing_audit_table"),
      fixture.database.prepare("SELECT 1"),
    ])
    try {
      const failedSuspension = await client.system.accounts[":accountId"].$patch({
        param: { accountId: concurrentBody.id },
        json: { status: "suspended" },
      })
      expect(Number(failedSuspension.status)).toBe(503)
    } finally {
      auditFailure.mockRestore()
    }
    expect(
      await fixture.database
        .prepare("SELECT status, token_version FROM system_accounts WHERE id = ?1")
        .bind(concurrentBody.id)
        .first<Record<string, unknown>>(),
    ).toEqual({ status: "locked", token_version: 1 })

    const retriedSuspension = await client.system.accounts[":accountId"].$patch({
      param: { accountId: concurrentBody.id },
      json: { status: "suspended" },
    })
    expect(retriedSuspension.status).toBe(200)
    expect(await retriedSuspension.json()).toMatchObject({ status: "suspended", token_version: 2 })
    expect(
      (
        await fixture.database
          .prepare(
            "SELECT before_json, after_json FROM system_audit_events WHERE target_id = ?1 AND action = 'system.account.status_updated' ORDER BY occurred_at",
          )
          .bind(concurrentBody.id)
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([
      {
        before_json: '{"status":"active","token_version":0}',
        after_json: '{"status":"locked","token_version":1}',
      },
      {
        before_json: '{"status":"locked","token_version":1}',
        after_json: '{"status":"suspended","token_version":2}',
      },
    ])
    clock.now = now

    await fixture.database
      .prepare(`INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?3, ?3),
                (?2, 'active', 0, ?3, ?3)`)
      .bind(delegatedAdministratorAccountId, scopedPrivilegedAccountId, now.getTime())
      .run()
    const delegatedStepUpToken = await seedSystemStepUpGrant(
      fixture,
      delegatedAdministratorAccountId,
      now,
    )
    await fixture.database
      .prepare(`INSERT INTO system_iam_roles
           (id, key, kind, name, created_at, updated_at)
         VALUES ('adbf4688-13c3-46e8-8262-1ed64af62d89', 'system:delegated-administrator', 'custom',
                 'Delegated administrator', ?1, ?1),
                ('92d93d3c-f92a-4336-86b6-65d1d1556667', 'example:privileged', 'custom',
                 'Scoped privileged role', ?1, ?1)`)
      .bind(now.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES ('adbf4688-13c3-46e8-8262-1ed64af62d89', 'iam:write'),
                ('92d93d3c-f92a-4336-86b6-65d1d1556667', 'example:privileged')`)
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES ('d47efb56-f8b4-4b94-8844-caf7c69588bf', ?1, 'adbf4688-13c3-46e8-8262-1ed64af62d89',
                 NULL, NULL, ?3, NULL),
                ('730ad3cb-8822-4e20-8e2e-868e04df129e', ?2, '92d93d3c-f92a-4336-86b6-65d1d1556667',
                 'example:organization', 'organization-1', ?3, NULL)`)
      .bind(delegatedAdministratorAccountId, scopedPrivilegedAccountId, now.getTime())
      .run()
    const delegatedAdministratorIssuance = requireIssuedSystemSession(
      await applications.issue.execute({
        accountId: delegatedAdministratorAccountId,
        tokenVersion: 0,
        now: new Date(),
        auditContext: { authorizationJson: null, metadataJson: null },
      }),
    )
    const delegatedAdministratorClient = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: {
        authorization: `Bearer ${delegatedAdministratorIssuance.accessToken}`,
        "x-system-step-up": delegatedStepUpToken,
      },
    })

    const scopedPrivilegeDenial = await delegatedAdministratorClient.system.accounts[
      ":accountId"
    ].$patch({
      param: { accountId: scopedPrivilegedAccountId },
      json: { status: "suspended" },
    })
    expect(Number(scopedPrivilegeDenial.status)).toBe(403)
    expect(
      await fixture.database
        .prepare("SELECT status, token_version FROM system_accounts WHERE id = ?1")
        .bind(scopedPrivilegedAccountId)
        .first<Record<string, unknown>>(),
    ).toEqual({ status: "active", token_version: 0 })
  })
})
