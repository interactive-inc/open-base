import { PATCH as rolePATCH } from "@system/interface/routes/system.roles.$roleId"
import { SystemD1AuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-authorization.adapter"
import { SystemRoleBindingRepository } from "@system/infrastructure/repositories/iam/system-role-binding.repository"
import { z } from "zod"
import { testAccountId } from "@system/test/system-test-id.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { seedSystemStepUpGrant } from "@system/test/seed-system-step-up-grant.test-support"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { DELETE } from "@system/interface/routes/system.accounts.$accountId.role-bindings.$bindingId"
import { GET, POST } from "@system/interface/routes/system.accounts.$accountId.role-bindings"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date()
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

async function bindingMutationFixture(shortStepUp = false, limitedActor = false) {
  const fixture = await SystemSessionTestContext.create()
  const at = new Date()
  const seedAt = new Date(at.getTime() - 600_000)
  await fixture.database
    .prepare(`INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?3, ?3), (?2, 'active', 0, ?3, ?3)`)
    .bind(rootAccountId, targetAccountId, seedAt.getTime())
    .run()
  const stepUpToken = await seedSystemStepUpGrant(
    fixture,
    rootAccountId,
    shortStepUp ? new Date(at.getTime() - 299_000) : at,
  )
  await fixture.database
    .prepare(`INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at, revoked_at)
         VALUES ('ac7f571e-ae97-4159-85e1-ba9cf4928de8', ?1, 'password', 'you@example.com', ?2, ?2, NULL)`)
    .bind(rootAccountId, seedAt.getTime())
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_iam_roles
           (id, key, kind, name, description, created_at, updated_at)
         VALUES ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'system:root', 'managed', 'System root', NULL, ?1, ?1),
                ('04635707-bd54-47ea-81d4-38426e3ce8a2', 'example:reader', 'custom', 'Example reader', NULL, ?1, ?1)`)
    .bind(seedAt.getTime())
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'iam:read'),
                ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'iam:write'),
                ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'system:admin'),
                ('04635707-bd54-47ea-81d4-38426e3ce8a2', 'example:read')`)
    .run()
  if (!limitedActor) {
    await fixture.database
      .prepare(`INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES ('f16b950f-c6db-4760-8994-95cc8065169d', ?1, 'af285551-000d-4320-8ea0-bbfbc6c96a81', NULL, NULL, ?2, NULL)`)
      .bind(rootAccountId, seedAt.getTime())
      .run()
  } else {
    await fixture.database.batch([
      fixture.database
        .prepare(
          "INSERT INTO system_iam_roles(id,key,kind,name,created_at,updated_at) VALUES ('9b0c38c9-d229-4da5-a7be-e695e31a9456','example:delegator','custom','Delegator',?1,?1)",
        )
        .bind(seedAt.getTime()),
      fixture.database.prepare(
        "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('9b0c38c9-d229-4da5-a7be-e695e31a9456','iam:write'),('9b0c38c9-d229-4da5-a7be-e695e31a9456','example:read')",
      ),
      fixture.database
        .prepare(
          "INSERT INTO system_role_bindings(id,account_id,role_id,resource_type,resource_id,created_at) VALUES ('f16b950f-c6db-4760-8994-95cc8065169d',?1,'9b0c38c9-d229-4da5-a7be-e695e31a9456',NULL,NULL,?2)",
        )
        .bind(rootAccountId, seedAt.getTime()),
    ])
  }

  const applications = createSystemSessionApplications({
    context: fixture.context,
    jwtSecret: "system-session-test-jwt-secret",
    sessionTtlMilliseconds: 604_800_000,
  })
  if (applications instanceof Error) throw applications
  const session = await applications.issue.execute({
    accountId: rootAccountId,
    tokenVersion: 0,
    now: new Date(),
    auditContext: { authorizationJson: null, metadataJson: null },
  })
  if (session instanceof Error || session.kind === "rejected")
    throw new Error("test session issuance failed")
  const app = systemFactory
    .createApp()
    .use("*", async (c, next) => {
      c.set("now", () => at)
      await next()
    })
    .post("/system/accounts/:accountId/role-bindings", ...POST)
    .delete("/system/accounts/:accountId/role-bindings/:bindingId", ...DELETE)
  const request = (
    method: string,
    id: string | null = null,
    resource: Readonly<{ type: string; id: string }> | null = null,
  ) =>
    app.request(
      `/system/accounts/${targetAccountId}/role-bindings${id === null ? "" : `/${id}`}`,
      {
        method,
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          "x-system-step-up": stepUpToken,
          "content-type": "application/json",
        },
        ...(method === "POST"
          ? {
              body: JSON.stringify({
                role_id: "04635707-bd54-47ea-81d4-38426e3ce8a2",
                resource,
              }),
            }
          : {}),
      },
      { DB: fixture.database, JWT_SECRET: "system-session-test-jwt-secret" },
    )
  const snapshot = () =>
    fixture.database
      .prepare(`SELECT
    (SELECT group_concat(id || ':' || token_version || ':' || updated_at) FROM system_accounts WHERE id=?1) AS accounts,
    (SELECT group_concat(id || ':' || coalesce(revoked_at,'active')) FROM system_role_bindings) AS bindings,
    (SELECT count(*) FROM system_audit_events) AS audits`)
      .bind(targetAccountId)
      .first<Record<string, unknown>>()
  return { database: fixture.database, request, snapshot, at }
}

type BindingMutationCase = Readonly<{
  operation: "create" | "revoke"
  change: "logout" | "version" | "step-up" | "expiry"
}>
const bindingMutationCases: ReadonlyArray<BindingMutationCase> = [
  { operation: "create", change: "logout" },
  { operation: "revoke", change: "logout" },
  { operation: "create", change: "version" },
  { operation: "revoke", change: "step-up" },
  { operation: "create", change: "expiry" },
]
for (const scenario of bindingMutationCases) {
  const operation = scenario.operation
  test(`Role Binding ${operation}保存前の${scenario.change}で対象と成功監査を変更しない`, async () => {
    const f = await bindingMutationFixture(scenario.change === "expiry")
    const binding =
      operation === "revoke"
        ? z.object({ id: z.string() }).parse(await (await f.request("POST")).json()).id
        : null
    const before = await f.snapshot()
    const create = spyOn(SystemRoleBindingRepository.prototype, "create")
    const revoke = spyOn(SystemRoleBindingRepository.prototype, "revoke")
    const originalCreate = create.getMockImplementation()
    const originalRevoke = revoke.getMockImplementation()
    if (!originalCreate || !originalRevoke) throw new Error("missing original binding methods")
    const logout = async () => {
      if (scenario.change === "version") {
        await f.database
          .prepare("UPDATE system_accounts SET token_version=token_version+1 WHERE id=?1")
          .bind(rootAccountId)
          .run()
        return
      }
      if (scenario.change === "step-up") {
        await f.database
          .prepare("UPDATE system_step_up_grants SET revoked_at=?1")
          .bind(Date.now())
          .run()
        return
      }
      if (scenario.change === "expiry") {
        const expiry = await f.database
          .prepare("SELECT max(expires_at) AS expiry FROM system_step_up_grants")
          .first<number>("expiry")
        if (expiry === null) throw new Error("missing step-up expiry")
        expect(Date.now()).toBeLessThan(expiry)
        await Bun.sleep(Math.max(0, expiry - Date.now()) + 50)
        return
      }
      await f.database.prepare("UPDATE system_sessions SET revoked_at=?1").bind(Date.now()).run()
    }
    create.mockImplementation(async function (this: SystemRoleBindingRepository, ...args) {
      if (operation === "create") await logout()
      return originalCreate.call(this, ...args)
    })
    revoke.mockImplementation(async function (this: SystemRoleBindingRepository, ...args) {
      if (operation === "revoke") await logout()
      return originalRevoke.call(this, ...args)
    })
    try {
      expect({
        status: (await f.request(operation === "create" ? "POST" : "DELETE", binding)).status,
        snapshot: await f.snapshot(),
      }).toEqual({ status: 403, snapshot: before })
    } finally {
      create.mockRestore()
      revoke.mockRestore()
    }
  })
}

for (const operation of ["create", "revoke"]) {
  test(`Role Binding ${operation} transaction中のlogoutは対象認証版と成功監査も巻き戻す`, async () => {
    const f = await bindingMutationFixture()
    const binding =
      operation === "revoke"
        ? z.object({ id: z.string() }).parse(await (await f.request("POST")).json()).id
        : null
    const before = await f.snapshot()
    const trigger = operation === "create" ? "INSERT" : "UPDATE OF revoked_at"
    await f.database
      .prepare(
        `CREATE TRIGGER revoke_binding_session AFTER ${trigger} ON system_role_bindings BEGIN UPDATE system_sessions SET revoked_at=${Date.now()}; END`,
      )
      .run()
    expect((await f.request(operation === "create" ? "POST" : "DELETE", binding)).status).toBe(403)
    expect(await f.snapshot()).toEqual(before)
  })
}

test("付与中にRoleへactor未保有のpermissionが追加されたらbindingを保存しない", async () => {
  const f = await bindingMutationFixture(false, true)
  const admin = zAccountId.parse(testAccountId("role-update-administrator"))
  const at = new Date()
  await f.database.batch([
    f.database
      .prepare(
        "INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES (?1,'active',0,?2,?2)",
      )
      .bind(admin, at.getTime()),
    f.database
      .prepare(
        "INSERT INTO system_identity_bindings(id,account_id,provider,subject,created_at,activated_at) VALUES (?1,?2,'password','operator@example.com',?3,?3)",
      )
      .bind(crypto.randomUUID(), admin, at.getTime()),
    f.database
      .prepare(
        "INSERT INTO system_role_bindings(id,account_id,role_id,resource_type,resource_id,created_at) VALUES (?1,?2,'af285551-000d-4320-8ea0-bbfbc6c96a81',NULL,NULL,?3)",
      )
      .bind(crypto.randomUUID(), admin, at.getTime()),
  ])
  const applications = createSystemSessionApplications({
    context: { env: { DB: f.database } },
    jwtSecret: "system-session-test-jwt-secret",
    sessionTtlMilliseconds: 604_800_000,
  })
  if (applications instanceof Error) throw applications
  const session = await applications.issue.execute({
    accountId: admin,
    tokenVersion: 0,
    now: new Date(),
    auditContext: { authorizationJson: null, metadataJson: null },
  })
  if (session instanceof Error || session.kind === "rejected")
    throw new Error("administrator session issuance failed")
  const stepUp = await seedSystemStepUpGrant({ database: f.database }, admin, at)
  const adminApp = systemFactory
    .createApp()
    .use("*", async (c, next) => {
      c.set("now", () => new Date())
      await next()
    })
    .patch("/system/roles/:roleId", ...rolePATCH)
  const actor = await new SystemD1AuthorizationAdapter({
    env: { DB: f.database },
  }).resolveForAccount({ accountId: rootAccountId, resource: null, at: new Date() })
  if (actor instanceof Error || actor === null) throw new Error("actor authorization unavailable")
  expect(actor.permissionKeys.has("iam:write")).toBe(true)
  expect(actor.permissionKeys.has("example:read")).toBe(true)
  expect(actor.permissionKeys.has("batch:view")).toBe(false)
  expect(actor.permissionKeys.has("system:admin")).toBe(false)
  const create = spyOn(SystemRoleBindingRepository.prototype, "create")
  const original = create.getMockImplementation()
  if (!original) throw new Error("missing original binding creation")
  create.mockImplementation(async function (this: SystemRoleBindingRepository, ...args) {
    const changed = await adminApp.request(
      "/system/roles/04635707-bd54-47ea-81d4-38426e3ce8a2",
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          "x-system-step-up": stepUp,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Updated reader",
          description: null,
          permission_keys: ["batch:view", "example:read"],
        }),
      },
      { DB: f.database, JWT_SECRET: "system-session-test-jwt-secret" },
    )
    expect(changed.status).toBe(200)
    return original.call(this, ...args)
  })
  try {
    const response = await f.request("POST")
    const target = await new SystemD1AuthorizationAdapter({
      env: { DB: f.database },
    }).resolveForAccount({ accountId: targetAccountId, resource: null, at: new Date() })
    if (target instanceof Error || target === null)
      throw new Error("target authorization unavailable")
    const version = await f.database
      .prepare("SELECT token_version FROM system_accounts WHERE id=?1")
      .bind(targetAccountId)
      .first<number>("token_version")
    expect({
      status: response.status,
      unexpectedPermission: target.permissionKeys.has("batch:view"),
      version,
    }).toEqual({ status: 409, unexpectedPermission: false, version: 0 })
  } finally {
    create.mockRestore()
  }
})

for (const operation of ["create", "revoke"]) {
  test(`Role Binding ${operation} transaction中のpermission変更は対象認証版と成功監査も巻き戻す`, async () => {
    const f = await bindingMutationFixture()
    const binding =
      operation === "revoke"
        ? z.object({ id: z.string() }).parse(await (await f.request("POST")).json()).id
        : null
    const before = await f.snapshot()
    const trigger = operation === "create" ? "INSERT" : "UPDATE OF revoked_at"
    await f.database
      .prepare(
        `CREATE TRIGGER change_binding_role AFTER ${trigger} ON system_role_bindings BEGIN INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('04635707-bd54-47ea-81d4-38426e3ce8a2','batch:view'); END`,
      )
      .run()
    expect((await f.request(operation === "create" ? "POST" : "DELETE", binding)).status).toBe(409)
    expect(await f.snapshot()).toEqual(before)
    expect(
      await f.database
        .prepare(
          "SELECT count(*) AS count FROM system_iam_role_permissions WHERE role_id='04635707-bd54-47ea-81d4-38426e3ce8a2' AND permission_key='batch:view'",
        )
        .first<number>("count"),
    ).toBe(0)
  })
}

test("permissionが空のRoleも付与と失効を行える", async () => {
  const f = await bindingMutationFixture()
  await f.database
    .prepare(
      "DELETE FROM system_iam_role_permissions WHERE role_id='04635707-bd54-47ea-81d4-38426e3ce8a2'",
    )
    .run()
  const created = await f.request("POST")
  expect(created.status).toBe(201)
  const binding = z.object({ id: z.string() }).parse(await created.json()).id
  const target = await new SystemD1AuthorizationAdapter({
    env: { DB: f.database },
  }).resolveForAccount({ accountId: targetAccountId, resource: null, at: new Date() })
  if (target instanceof Error || target === null)
    throw new Error("target authorization unavailable")
  expect(target.permissionKeys.size).toBe(0)
  expect((await f.request("DELETE", binding)).status).toBe(204)
})

test("範囲付きRoleも付与と失効を行える", async () => {
  const f = await bindingMutationFixture()
  await f.database
    .prepare(
      "UPDATE system_iam_roles SET resource_type='system:connector' WHERE id='04635707-bd54-47ea-81d4-38426e3ce8a2'",
    )
    .run()
  const resource = { type: "system:connector", id: "example-connector" }
  const created = await f.request("POST", null, resource)
  expect(created.status).toBe(201)
  const binding = z.object({ id: z.string() }).parse(await created.json()).id
  const stored = await f.database
    .prepare(
      "SELECT resource_type AS type, resource_id AS id FROM system_role_bindings WHERE id=?1",
    )
    .bind(binding)
    .first()
  expect(stored).toEqual(resource)
  expect((await f.request("DELETE", binding)).status).toBe(204)
})

test("付与対象Roleが保存前に消失したら競合として拒否する", async () => {
  const f = await bindingMutationFixture()
  const before = await f.snapshot()
  const create = spyOn(SystemRoleBindingRepository.prototype, "create")
  const original = create.getMockImplementation()
  if (!original) throw new Error("missing original binding creation")
  create.mockImplementation(async function (this: SystemRoleBindingRepository, ...args) {
    await f.database.batch([
      f.database.prepare(
        "DELETE FROM system_iam_role_permissions WHERE role_id='04635707-bd54-47ea-81d4-38426e3ce8a2'",
      ),
      f.database.prepare(
        "DELETE FROM system_iam_roles WHERE id='04635707-bd54-47ea-81d4-38426e3ce8a2'",
      ),
    ])
    return original.call(this, ...args)
  })
  try {
    expect((await f.request("POST")).status).toBe(409)
    expect(await f.snapshot()).toEqual(before)
  } finally {
    create.mockRestore()
  }
})
