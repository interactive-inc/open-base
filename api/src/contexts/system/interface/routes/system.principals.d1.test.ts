import { z } from "zod"
import { SystemPrincipalRepository } from "@system/infrastructure/repositories/iam/system-principal.repository"
import { SystemMachineCredentialRepository } from "@system/infrastructure/repositories/iam/system-machine-credential.repository"
import { PATCH as principalPATCH } from "@system/interface/routes/system.principals.$principalId"
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
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
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
      .bind(rootAccountId, stepUpHash, now.getTime(), Date.now() + 300_000)
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

async function mutationFixture(stepUpTtlMilliseconds = 300_000) {
  const fixture = await SystemSessionTestContext.create()
  await seedRoot(fixture)
  const accessToken = await issueRootAccessToken(fixture)
  if (accessToken instanceof Error) throw accessToken
  const raw = "2".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(raw)
  if (hash instanceof Error) throw hash
  await fixture.database
    .prepare(`INSERT INTO system_step_up_grants
    (id,account_id,token_hash,method,issued_at,expires_at) VALUES (?1,?2,?3,'password',?4,?5)`)
    .bind(
      crypto.randomUUID(),
      rootAccountId,
      hash,
      now.getTime(),
      Date.now() + stepUpTtlMilliseconds,
    )
    .run()
  const app = systemFactory
    .createApp()
    .use("*", async (c, next) => {
      c.set("now", () => now)
      await next()
    })
    .post("/system/principals", ...principalsPOST)
    .patch("/system/principals/:principalId", ...principalPATCH)
    .post("/system/principals/:principalId/machine-credentials", ...credentialsPOST)
    .delete(
      "/system/principals/:principalId/machine-credentials/:credentialId",
      ...credentialDELETE,
    )
  const request = (path: string, method: string, body: unknown) =>
    app.request(
      path,
      {
        method,
        headers: {
          authorization: `Bearer ${accessToken}`,
          "x-system-step-up": raw,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
      { DB: fixture.database, JWT_SECRET: jwtSecret },
    )
  const principalResponse = await request("/system/principals", "POST", {
    kind: "agent",
    name: "Example agent",
  })
  expect(principalResponse.status).toBe(201)
  const principal = z
    .object({ principal: z.object({ id: z.string() }) })
    .parse(await principalResponse.json()).principal
  const credentialResponse = await request(
    `/system/principals/${principal.id}/machine-credentials`,
    "POST",
    { name: "Example credential", expires_at: null, reason: "Test provisioning" },
  )
  expect(credentialResponse.status).toBe(201)
  const credential = z
    .object({ credential: z.object({ id: z.string() }) })
    .parse(await credentialResponse.json()).credential
  const snapshot = () =>
    fixture.database
      .prepare(`SELECT
    (SELECT count(*) FROM system_accounts) AS accounts,
    (SELECT group_concat(name) FROM system_principals) AS names,
    (SELECT group_concat(status) FROM system_machine_credentials) AS credentials,
    (SELECT count(*) FROM system_audit_events) AS audits`)
      .first<Record<string, unknown>>()
  return { database: fixture.database, request, principal, credential, snapshot }
}

type MutationCase = Readonly<{
  operation: "principal-create" | "principal-update" | "credential-create" | "credential-revoke"
  change: "logout" | "authority" | "step-up" | "version" | "expiry"
}>
const mutationCases: ReadonlyArray<MutationCase> = [
  { operation: "principal-create", change: "logout" },
  { operation: "principal-update", change: "logout" },
  { operation: "credential-create", change: "logout" },
  { operation: "credential-revoke", change: "logout" },
  { operation: "credential-create", change: "authority" },
  { operation: "credential-create", change: "step-up" },
  { operation: "credential-create", change: "version" },
  { operation: "credential-create", change: "expiry" },
]
for (const scenario of mutationCases) {
  const operation = scenario.operation
  test(`${operation}保存前の${scenario.change}で状態と成功監査と秘密値を返さない`, async () => {
    const f = await mutationFixture(scenario.change === "expiry" ? 1000 : 300_000)
    const before = await f.snapshot()
    const revoke = async () => {
      if (scenario.change === "authority") {
        await f.database
          .prepare("UPDATE system_role_bindings SET revoked_at=?1")
          .bind(now.getTime())
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
      if (scenario.change === "version") {
        await f.database
          .prepare("UPDATE system_accounts SET token_version=token_version+1 WHERE id=?1")
          .bind(rootAccountId)
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
    const create = spyOn(SystemPrincipalRepository.prototype, "create")
    const update = spyOn(SystemPrincipalRepository.prototype, "update")
    const issue = spyOn(SystemMachineCredentialRepository.prototype, "create")
    const remove = spyOn(SystemMachineCredentialRepository.prototype, "revoke")
    const originalCreate = create.getMockImplementation()
    const originalUpdate = update.getMockImplementation()
    const originalIssue = issue.getMockImplementation()
    const originalRemove = remove.getMockImplementation()
    if (!originalCreate || !originalUpdate || !originalIssue || !originalRemove)
      throw new Error("missing original mutation methods")
    create.mockImplementation(async function (this: SystemPrincipalRepository, ...args) {
      if (operation === "principal-create") await revoke()
      return originalCreate.call(this, ...args)
    })
    update.mockImplementation(async function (this: SystemPrincipalRepository, ...args) {
      if (operation === "principal-update") await revoke()
      return originalUpdate.call(this, ...args)
    })
    issue.mockImplementation(async function (this: SystemMachineCredentialRepository, ...args) {
      if (operation === "credential-create") await revoke()
      return originalIssue.call(this, ...args)
    })
    remove.mockImplementation(async function (this: SystemMachineCredentialRepository, ...args) {
      if (operation === "credential-revoke") await revoke()
      return originalRemove.call(this, ...args)
    })
    try {
      const responses = {
        "principal-create": () =>
          f.request("/system/principals", "POST", { kind: "service", name: "Example service" }),
        "principal-update": () =>
          f.request(`/system/principals/${f.principal.id}`, "PATCH", {
            name: "Changed name",
            expected_revision: 1,
            reason: "Test rename",
          }),
        "credential-create": () =>
          f.request(`/system/principals/${f.principal.id}/machine-credentials`, "POST", {
            name: "Extra credential",
            expires_at: null,
            reason: "Test provisioning",
          }),
        "credential-revoke": () =>
          f.request(
            `/system/principals/${f.principal.id}/machine-credentials/${f.credential.id}`,
            "DELETE",
            { reason: "Test revocation" },
          ),
      }
      const response = await responses[operation]()
      const snapshot = await f.snapshot()
      expect({ status: response.status, snapshot }).toEqual({ status: 403, snapshot: before })
      expect(await response.text()).not.toContain('"secret":')
    } finally {
      create.mockRestore()
      update.mockRestore()
      issue.mockRestore()
      remove.mockRestore()
    }
  })
}

for (const kind of ["principal", "credential"]) {
  test(`${kind}の保存transaction内のlogoutで状態と監査を巻き戻す`, async () => {
    const f = await mutationFixture()
    const before = await f.snapshot()
    const table = kind === "principal" ? "system_principals" : "system_machine_credentials"
    await f.database
      .prepare(
        `CREATE TRIGGER revoke_mutation_session AFTER INSERT ON ${table} BEGIN UPDATE system_sessions SET revoked_at=${Date.now()}; END`,
      )
      .run()
    const response =
      kind === "principal"
        ? await f.request("/system/principals", "POST", { kind: "service", name: "Extra service" })
        : await f.request(`/system/principals/${f.principal.id}/machine-credentials`, "POST", {
            name: "Extra credential",
            expires_at: null,
            reason: "Test provisioning",
          })
    expect(response.status).toBe(403)
    expect(await f.snapshot()).toEqual(before)
    expect(await response.text()).not.toContain('"secret":')
  })
}

test("現在の資格で名称変更し、再失効も安全に受け付ける", async () => {
  const f = await mutationFixture()
  expect(
    (
      await f.request(`/system/principals/${f.principal.id}`, "PATCH", {
        name: "Updated agent",
        expected_revision: 1,
        reason: "Test rename",
      })
    ).status,
  ).toBe(200)
  const path = `/system/principals/${f.principal.id}/machine-credentials/${f.credential.id}`
  expect((await f.request(path, "DELETE", { reason: "Test revocation" })).status).toBe(204)
  expect((await f.request(path, "DELETE", { reason: "Test revocation" })).status).toBe(204)
})

test("既に失効したcredentialへの再送も途中logoutを拒否する", async () => {
  const f = await mutationFixture()
  const path = `/system/principals/${f.principal.id}/machine-credentials/${f.credential.id}`
  expect((await f.request(path, "DELETE", { reason: "Test revocation" })).status).toBe(204)
  const before = await f.snapshot()
  const revoke = spyOn(SystemMachineCredentialRepository.prototype, "revoke")
  const original = revoke.getMockImplementation()
  if (original === undefined) throw new Error("missing original credential revocation")
  revoke.mockImplementation(async function (this: SystemMachineCredentialRepository, ...args) {
    await f.database.prepare("UPDATE system_sessions SET revoked_at=?1").bind(Date.now()).run()
    return original.call(this, ...args)
  })
  try {
    expect((await f.request(path, "DELETE", { reason: "Test revocation" })).status).toBe(403)
    expect(await f.snapshot()).toEqual(before)
  } finally {
    revoke.mockRestore()
  }
})

test("現在の資格で操作者自身のPrincipal名も変更できる", async () => {
  const f = await mutationFixture()
  const response = await f.request(
    "/system/principals/4d0f979a-6d3b-4d7b-9be0-fe4b3a99e1d2",
    "PATCH",
    { name: "Renamed operator", expected_revision: 1, reason: "Test rename" },
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    principal: { name: "Renamed operator", revision: 2 },
  })
})

test("自己名称変更の予定版を許しても途中のIAM失権は許さない", async () => {
  const f = await mutationFixture()
  const before = await f.snapshot()
  await f.database
    .prepare(`CREATE TRIGGER revoke_self_rename_authority AFTER UPDATE OF name ON system_principals
    BEGIN UPDATE system_role_bindings SET revoked_at=${now.getTime()}; END`)
    .run()
  const response = await f.request(
    "/system/principals/4d0f979a-6d3b-4d7b-9be0-fe4b3a99e1d2",
    "PATCH",
    { name: "Renamed operator", expected_revision: 1, reason: "Test rename" },
  )
  expect(response.status).toBe(403)
  expect(await f.snapshot()).toEqual(before)
})
