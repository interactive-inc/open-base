import { SystemRoleCatalogRepository } from "@system/infrastructure/repositories/iam/system-role-catalog.repository"
import { z } from "zod"
import { testAccountId } from "@system/test/system-test-id.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { seedSystemStepUpGrant } from "@system/test/seed-system-step-up-grant.test-support"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { DELETE, GET as GET_ONE, PATCH } from "@system/interface/routes/system.roles.$roleId"
import { GET as GET_MANY, POST } from "@system/interface/routes/system.roles"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date()
const rootAccountId = zAccountId.parse(testAccountId("system-role-root"))

describe("System Role HTTP", () => {
  test("custom Roleの作成・一覧・詳細・変更・削除をSystemだけで完結する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await fixture.database
      .prepare(`INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`)
      .bind(rootAccountId, now.getTime())
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
      .get("/system/roles", ...GET_MANY)
      .post("/system/roles", ...POST)
      .get("/system/roles/:roleId", ...GET_ONE)
      .patch("/system/roles/:roleId", ...PATCH)
      .delete("/system/roles/:roleId", ...DELETE)
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

    const created = await client.system.roles.$post({
      json: {
        key: "example:reader",
        name: "Example reader",
        description: "Reads Company records",
        permission_keys: ["example:read"],
      },
    })
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect("id" in createdBody).toBe(true)
    if (!("id" in createdBody)) return
    expect(createdBody).toMatchObject({ key: "example:reader", kind: "custom" })

    const listed = await client.system.roles.$get()
    expect(listed.status).toBe(200)
    const listedBody = await listed.json()
    expect("total" in listedBody).toBe(true)
    if (!("total" in listedBody)) return
    expect(listedBody.total).toBe(2)

    const detailed = await client.system.roles[":roleId"].$get({
      param: { roleId: createdBody.id },
    })
    expect(detailed.status).toBe(200)
    expect(await detailed.json()).toMatchObject({ permission_keys: ["example:read"] })

    const updated = await client.system.roles[":roleId"].$patch({
      param: { roleId: createdBody.id },
      json: {
        name: "Company editor",
        description: "Reads and writes Company records",
        permission_keys: ["example:write", "example:read"],
      },
    })
    expect(updated.status).toBe(200)
    expect(await updated.json()).toMatchObject({
      name: "Company editor",
      permission_keys: ["example:read", "example:write"],
    })

    const managedDeletion = await client.system.roles[":roleId"].$delete({
      param: { roleId: "af285551-000d-4320-8ea0-bbfbc6c96a81" },
    })
    expect(Number(managedDeletion.status)).toBe(409)

    const deleted = await client.system.roles[":roleId"].$delete({
      param: { roleId: createdBody.id },
    })
    expect(deleted.status).toBe(204)
    expect(
      await fixture.database
        .prepare(`SELECT count(*) AS total
           FROM system_audit_events
           WHERE action LIKE 'system.iam.role.%'`)
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 3 })
  })
})

async function roleMutationFixture(shortStepUp = false) {
  const now = new Date()
  const fixture = await SystemSessionTestContext.create()
  await fixture.database
    .prepare(`INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`)
    .bind(rootAccountId, now.getTime())
    .run()
  const stepUpToken = await seedSystemStepUpGrant(
    fixture,
    rootAccountId,
    new Date(now.getTime() - (shortStepUp ? 299_000 : 0)),
  )
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
  if (applications instanceof Error) throw applications
  const issuance = await applications.issue.execute({
    accountId: rootAccountId,
    tokenVersion: 0,
    now: new Date(),
    auditContext: { authorizationJson: null, metadataJson: null },
  })
  expect(issuance).not.toBeInstanceOf(Error)
  if (issuance instanceof Error || issuance.kind === "rejected")
    throw new Error("test session issuance failed")

  const app = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => now)
      await next()
    })
    .get("/system/roles", ...GET_MANY)
    .post("/system/roles", ...POST)
    .get("/system/roles/:roleId", ...GET_ONE)
    .patch("/system/roles/:roleId", ...PATCH)
    .delete("/system/roles/:roleId", ...DELETE)
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

  const created = await client.system.roles.$post({
    json: {
      key: "example:reader",
      name: "Example reader",
      description: null,
      permission_keys: ["example:read"],
    },
  })
  expect(created.status).toBe(201)
  const role = z.object({ id: z.string() }).parse(await created.json())
  const mutate = (operation: string, permissionKeys: ReadonlyArray<string> = ["example:read"]) =>
    request(operation === "create" ? "/system/roles" : `/system/roles/${role.id}`, {
      method: operation === "create" ? "POST" : operation === "delete" ? "DELETE" : "PATCH",
      headers: {
        authorization: `Bearer ${issuance.accessToken}`,
        "x-system-step-up": stepUpToken,
        "content-type": "application/json",
      },
      ...(operation === "delete"
        ? {}
        : {
            body: JSON.stringify(
              operation === "create"
                ? {
                    key: "example:other",
                    name: "Other reader",
                    description: null,
                    permission_keys: permissionKeys,
                  }
                : {
                    name: operation === "unchanged" ? "Example reader" : "Updated reader",
                    description: null,
                    permission_keys: permissionKeys,
                  },
            ),
          }),
    })
  const snapshot = () =>
    fixture.database
      .prepare(`SELECT
      (SELECT json_group_array(json_array(id,key,name,updated_at)) FROM system_iam_roles) AS roles,
      (SELECT json_group_array(json_array(role_id,permission_key)) FROM system_iam_role_permissions) AS permissions,
      (SELECT json_group_array(json_array(id,token_version,updated_at)) FROM system_accounts) AS accounts,
      (SELECT count(*) FROM system_audit_events) AS audits`)
      .first()
  const read = (path: string) =>
    request(path, { headers: { authorization: `Bearer ${issuance.accessToken}` } })
  return { database: fixture.database, mutate, snapshot, roleId: role.id, at: now, read }
}

for (const operation of ["create", "update", "delete", "unchanged"]) {
  test(`Role ${operation}直前のlogoutでRoleと成功監査を変更しない`, async () => {
    const f = await roleMutationFixture()
    const before = await f.snapshot()
    const create = spyOn(SystemRoleCatalogRepository.prototype, "create")
    const update = spyOn(SystemRoleCatalogRepository.prototype, "update")
    const remove = spyOn(SystemRoleCatalogRepository.prototype, "delete")
    const find = spyOn(SystemRoleCatalogRepository.prototype, "find")
    const originalCreate = create.getMockImplementation()
    const originalUpdate = update.getMockImplementation()
    const originalDelete = remove.getMockImplementation()
    const originalFind = find.getMockImplementation()
    if (!originalCreate || !originalUpdate || !originalDelete || !originalFind)
      throw new Error("missing original role methods")
    const logout = () =>
      f.database.prepare("UPDATE system_sessions SET revoked_at=?1").bind(Date.now()).run()
    create.mockImplementation(async function (this: SystemRoleCatalogRepository, ...args) {
      if (operation === "create") await logout()
      return originalCreate.call(this, ...args)
    })
    update.mockImplementation(async function (this: SystemRoleCatalogRepository, ...args) {
      if (operation === "update") await logout()
      return originalUpdate.call(this, ...args)
    })
    remove.mockImplementation(async function (this: SystemRoleCatalogRepository, ...args) {
      if (operation === "delete") await logout()
      return originalDelete.call(this, ...args)
    })
    find.mockImplementation(async function (this: SystemRoleCatalogRepository, ...args) {
      const role = await originalFind.call(this, ...args)
      if (operation === "unchanged") await logout()
      return role
    })
    try {
      expect((await f.mutate(operation)).status).toBe(403)
      expect(await f.snapshot()).toEqual(before)
    } finally {
      create.mockRestore()
      update.mockRestore()
      remove.mockRestore()
      find.mockRestore()
    }
  })
}

for (const operation of ["create", "update", "delete"]) {
  test(`Role ${operation} transaction中のlogoutで変更と成功監査を巻き戻す`, async () => {
    const f = await roleMutationFixture()
    const before = await f.snapshot()
    const action = operation === "create" ? "INSERT" : operation === "delete" ? "DELETE" : "UPDATE"
    await f.database
      .prepare(
        `CREATE TRIGGER logout_role_actor AFTER ${action} ON system_iam_roles BEGIN UPDATE system_sessions SET revoked_at=${Date.now()}; END`,
      )
      .run()
    expect((await f.mutate(operation)).status).toBe(403)
    expect(await f.snapshot()).toEqual(before)
  })
}

for (const operation of ["create", "update", "delete", "unchanged"]) {
  test(`Role ${operation}中のstep-up失効を保存と成功応答で再照合する`, async () => {
    const f = await roleMutationFixture()
    const before = await f.snapshot()
    const find = spyOn(SystemRoleCatalogRepository.prototype, "find")
    const create = spyOn(SystemRoleCatalogRepository.prototype, "create")
    const originalFind = find.getMockImplementation()
    const originalCreate = create.getMockImplementation()
    if (!originalFind || !originalCreate) throw new Error("missing original role methods")
    const revoke = () =>
      f.database.prepare("UPDATE system_step_up_grants SET revoked_at=?1").bind(Date.now()).run()
    find.mockImplementation(async function (this: SystemRoleCatalogRepository, ...args) {
      const role = await originalFind.call(this, ...args)
      await revoke()
      return role
    })
    create.mockImplementation(async function (this: SystemRoleCatalogRepository, ...args) {
      await revoke()
      return originalCreate.call(this, ...args)
    })
    try {
      expect((await f.mutate(operation)).status).toBe(403)
      expect(await f.snapshot()).toEqual(before)
    } finally {
      find.mockRestore()
      create.mockRestore()
    }
  })
}

for (const permissions of [["example:read", "example:write"], []]) {
  test(`自己割当Roleのpermission更新${JSON.stringify(permissions)}と認証版更新を許す`, async () => {
    const f = await roleMutationFixture()
    await f.database
      .prepare(
        "INSERT INTO system_role_bindings(id,account_id,role_id,resource_type,resource_id,created_at) VALUES (?1,?2,?3,NULL,NULL,?4)",
      )
      .bind(crypto.randomUUID(), rootAccountId, f.roleId, f.at.getTime())
      .run()
    const response = await f.mutate("update", permissions)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ permission_keys: permissions })
    expect(
      await f.database
        .prepare("SELECT token_version FROM system_accounts WHERE id=?1")
        .bind(rootAccountId)
        .first<number>("token_version"),
    ).toBe(1)
  })
}

test("自己割当Role更新中の予定外の認証版変更を巻き戻す", async () => {
  const f = await roleMutationFixture()
  await f.database
    .prepare(
      "INSERT INTO system_role_bindings(id,account_id,role_id,resource_type,resource_id,created_at) VALUES (?1,?2,?3,NULL,NULL,?4)",
    )
    .bind(crypto.randomUUID(), rootAccountId, f.roleId, f.at.getTime())
    .run()
  const before = await f.snapshot()
  await f.database
    .prepare(
      `CREATE TRIGGER change_role_actor AFTER UPDATE ON system_iam_roles BEGIN UPDATE system_accounts SET token_version=token_version+1 WHERE id='${rootAccountId}'; END`,
    )
    .run()
  expect((await f.mutate("update", ["example:read", "example:write"])).status).toBe(403)
  expect(await f.snapshot()).toEqual(before)
})

for (const operation of ["create", "update", "delete"]) {
  test(`Role ${operation} transaction中のstep-up失効を巻き戻す`, async () => {
    const f = await roleMutationFixture()
    const before = await f.snapshot()
    const action = operation === "create" ? "INSERT" : operation === "delete" ? "DELETE" : "UPDATE"
    await f.database
      .prepare(
        `CREATE TRIGGER expire_role_step_up AFTER ${action} ON system_iam_roles BEGIN UPDATE system_step_up_grants SET revoked_at=${Date.now()}; END`,
      )
      .run()
    expect((await f.mutate(operation)).status).toBe(403)
    expect(await f.snapshot()).toEqual(before)
  })
}

test("Role保存前に実時間でstep-up期限が切れたら拒否する", async () => {
  const f = await roleMutationFixture(true)
  const before = await f.snapshot()
  const create = spyOn(SystemRoleCatalogRepository.prototype, "create")
  const original = create.getMockImplementation()
  if (!original) throw new Error("missing original role creation")
  create.mockImplementation(async function (this: SystemRoleCatalogRepository, ...args) {
    const expiry = await f.database
      .prepare("SELECT expires_at FROM system_step_up_grants")
      .first<number>("expires_at")
    if (expiry === null) throw new Error("missing step-up expiry")
    expect(Date.now()).toBeLessThan(expiry)
    await Bun.sleep(Math.max(0, expiry - Date.now()) + 50)
    return original.call(this, ...args)
  })
  try {
    expect((await f.mutate("create")).status).toBe(403)
    expect(await f.snapshot()).toEqual(before)
  } finally {
    create.mockRestore()
  }
})

test("自己の複数scopeに割り当てたRoleも予定したpermission更新だけを許す", async () => {
  const f = await roleMutationFixture()
  await f.database
    .prepare("UPDATE system_iam_roles SET resource_type='system:connector' WHERE id=?1")
    .bind(f.roleId)
    .run()
  for (const resourceId of ["example-first", "example-second"]) {
    await f.database
      .prepare(
        "INSERT INTO system_role_bindings(id,account_id,role_id,resource_type,resource_id,created_at) VALUES (?1,?2,?3,'system:connector',?4,?5)",
      )
      .bind(crypto.randomUUID(), rootAccountId, f.roleId, resourceId, f.at.getTime())
      .run()
  }
  expect((await f.mutate("update", ["example:read", "example:write"])).status).toBe(200)
  expect(
    await f.database
      .prepare("SELECT token_version FROM system_accounts WHERE id=?1")
      .bind(rootAccountId)
      .first<number>("token_version"),
  ).toBe(1)
})

test("非管理者が自己Roleのiam:writeを除く変更も正当な認証版遷移として確定する", async () => {
  const f = await roleMutationFixture()
  const admin = zAccountId.parse(testAccountId("role-preserved-administrator"))
  await f.database.batch([
    f.database
      .prepare(
        "INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES (?1,'active',0,?2,?2)",
      )
      .bind(admin, f.at.getTime()),
    f.database
      .prepare(
        "INSERT INTO system_identity_bindings(id,account_id,provider,subject,created_at,activated_at) VALUES (?1,?2,'password','operator@example.com',?3,?3)",
      )
      .bind(crypto.randomUUID(), admin, f.at.getTime()),
    f.database
      .prepare("UPDATE system_role_bindings SET revoked_at=?1 WHERE account_id=?2")
      .bind(f.at.getTime(), rootAccountId),
    f.database
      .prepare(
        "INSERT INTO system_role_bindings(id,account_id,role_id,resource_type,resource_id,created_at) VALUES (?1,?2,'af285551-000d-4320-8ea0-bbfbc6c96a81',NULL,NULL,?3)",
      )
      .bind(crypto.randomUUID(), admin, f.at.getTime()),
    f.database
      .prepare(
        "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES (?1,'iam:write')",
      )
      .bind(f.roleId),
    f.database
      .prepare(
        "INSERT INTO system_role_bindings(id,account_id,role_id,resource_type,resource_id,created_at) VALUES (?1,?2,?3,NULL,NULL,?4)",
      )
      .bind(crypto.randomUUID(), rootAccountId, f.roleId, f.at.getTime()),
  ])
  const response = await f.mutate("update", [])
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ permission_keys: [] })
  expect(
    await f.database
      .prepare("SELECT token_version FROM system_accounts WHERE id=?1")
      .bind(rootAccountId)
      .first<number>("token_version"),
  ).toBe(1)
})

for (const change of ["logout", "version", "authority"]) {
  for (const target of ["list", "detail", "absent"]) {
    test(`Role参照${target}の読取後${change}で定義を開示しない`, async () => {
      const f = await roleMutationFixture()
      const list = spyOn(SystemRoleCatalogRepository.prototype, "findMany")
      const find = spyOn(SystemRoleCatalogRepository.prototype, "find")
      const originalList = list.getMockImplementation()
      const originalFind = find.getMockImplementation()
      if (!originalList || !originalFind) throw new Error("missing original Role reads")
      const revoke = async () => {
        if (change === "version")
          await f.database
            .prepare("UPDATE system_accounts SET token_version=token_version+1 WHERE id=?1")
            .bind(rootAccountId)
            .run()
        if (change === "authority")
          await f.database
            .prepare("UPDATE system_role_bindings SET revoked_at=?1 WHERE account_id=?2")
            .bind(Date.now(), rootAccountId)
            .run()
        if (change === "logout")
          await f.database
            .prepare("UPDATE system_sessions SET revoked_at=?1 WHERE account_id=?2")
            .bind(Date.now(), rootAccountId)
            .run()
      }
      list.mockImplementation(async function (this: SystemRoleCatalogRepository, ...args) {
        const found = await originalList.call(this, ...args)
        if (target === "list") await revoke()
        return found
      })
      find.mockImplementation(async function (this: SystemRoleCatalogRepository, ...args) {
        const found = await originalFind.call(this, ...args)
        if (target !== "list") await revoke()
        return found
      })
      try {
        const response = await f.read(
          target === "list"
            ? "/system/roles"
            : `/system/roles/${target === "absent" ? "a09b38c2-26dd-47ad-87d3-60ea86a38b18" : f.roleId}`,
        )
        expect({
          status: response.status,
          disclosed: (await response.text()).includes("example:reader"),
        }).toEqual({ status: 403, disclosed: false })
      } finally {
        list.mockRestore()
        find.mockRestore()
      }
    })
  }
}

for (const mode of ["read", "admin", "scoped"]) {
  test(`Role参照のglobal read/adminとscope分離を維持する: ${mode}`, async () => {
    const f = await roleMutationFixture()
    const roleId = crypto.randomUUID()
    const resourceType = mode === "scoped" ? "example:record" : null
    await f.database.batch([
      f.database
        .prepare("UPDATE system_role_bindings SET revoked_at=?1 WHERE account_id=?2")
        .bind(f.at.getTime(), rootAccountId),
      f.database
        .prepare(
          "INSERT INTO system_iam_roles(id,key,kind,resource_type,name,created_at,updated_at) VALUES (?1,'example:read_access','custom',?2,'Read access',?3,?3)",
        )
        .bind(roleId, resourceType, f.at.getTime()),
      f.database
        .prepare("INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES (?1,?2)")
        .bind(roleId, mode === "admin" ? "system:admin" : "iam:read"),
      f.database
        .prepare(
          "INSERT INTO system_role_bindings(id,account_id,role_id,resource_type,resource_id,created_at) VALUES (?1,?2,?3,?4,?5,?6)",
        )
        .bind(
          crypto.randomUUID(),
          rootAccountId,
          roleId,
          resourceType,
          resourceType === null ? null : "example-record",
          f.at.getTime(),
        ),
    ])
    const listed = await f.read("/system/roles")
    expect(listed.status).toBe(mode === "scoped" ? 403 : 200)
    const detailed = await f.read(`/system/roles/${f.roleId}`)
    expect(detailed.status).toBe(mode === "scoped" ? 403 : 200)
    if (mode !== "scoped") {
      expect(await listed.text()).toContain("example:reader")
      expect(await detailed.json()).toMatchObject({ permission_keys: ["example:read"] })
    }
    expect((await f.read("/system/roles/a09b38c2-26dd-47ad-87d3-60ea86a38b18")).status).toBe(
      mode === "scoped" ? 403 : 404,
    )
  })
}
