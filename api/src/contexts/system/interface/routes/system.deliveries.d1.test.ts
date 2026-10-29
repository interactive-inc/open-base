import { prepareSystemWriteAuthorization } from "@system/interface/authorization/prepare-system-write-authorization"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemDeliveryEntity } from "@system/domain/entities/system-delivery.entity"
import { SystemDeliveryRepository } from "@system/infrastructure/repositories/events/system-delivery.repository"
import { SystemForbiddenError } from "@system/interface/errors"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { GET as deadLettersGET } from "@system/interface/routes/system.dead-letters"
import { POST as deadLetterRequeuePOST } from "@system/interface/routes/system.dead-letters.$deadLetterId.requeue"
import { PATCH as deliveryPATCH } from "@system/interface/routes/system.deliveries.$deliveryId"
import {
  GET as deliveriesGET,
  POST as deliveriesPOST,
} from "@system/interface/routes/system.deliveries"
import { POST as machineSessionPOST } from "@system/interface/routes/system.machine-sessions"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { seedSystemStepUpGrant } from "@system/test/seed-system-step-up-grant.test-support"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { hc } from "hono/client"
import { z } from "zod"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const accountId = zAccountId.parse("37d00139-429b-4419-97c9-2def4b6e1ffe")
const jwtSecret = "system-session-test-jwt-secret"
const now = new Date()

describe("System delivery HTTP", () => {
  test("登録処理のjobは管理者の汎用APIからclaim・完了・再投入できない", async () => {
    const fixture = await SystemSessionTestContext.create()
    await seedWorker(fixture)
    const stepUpToken = await seedSystemStepUpGrant(fixture, accountId, now)
    const accessToken = await issueAccessToken(fixture)
    if (accessToken instanceof Error) throw accessToken
    const repository = new SystemDeliveryRepository(fixture.context)
    const queued = SystemDeliveryEntity.create({
      id: "01900054-0000-7000-8000-000000000003",
      kind: "job",
      handlerKey: "example.record",
      operationKey: "example.record",
      payloadDigest: "a".repeat(64),
      idempotencyKey: "event:1",
      status: "queued",
      attempt: 0,
      maxAttempts: 1,
      availableAt: now,
      leaseAccountId: null,
      leaseTokenHash: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    })
    if (queued instanceof Error) throw queued
    expect(await repository.create(queued, accountId, null, [])).toBe("created")
    const app = systemFactory
      .createApp()
      .onError((error, context) =>
        context.json({ message: error.message }, error instanceof SystemForbiddenError ? 403 : 500),
      )
      .use("*", async (context, next) => {
        context.set("now", () => now)
        await next()
      })
      .patch("/system/deliveries/:deliveryId", ...deliveryPATCH)
      .post("/system/dead-letters/:deadLetterId/requeue", ...deadLetterRequeuePOST)
    const request = (path: string, method: string, body: unknown) =>
      app.request(
        path,
        {
          method,
          headers: {
            authorization: `Bearer ${accessToken}`,
            "x-system-step-up": stepUpToken,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        },
        { DB: fixture.context.env.DB, JWT_SECRET: jwtSecret },
      )
    expect(
      (
        await request("/system/deliveries/01900054-0000-7000-8000-000000000003", "PATCH", {
          kind: "job",
          action: "claim",
          lease_seconds: 30,
        })
      ).status,
    ).toBe(403)
    const leased = queued.claim(accountId, "b".repeat(64), now, 30_000)
    if (leased instanceof Error) throw leased
    expect(await repository.update(queued, leased, [])).toBe("updated")
    for (const action of ["succeed", "heartbeat", "fail", "recover"]) {
      const body =
        action === "recover"
          ? { kind: "job", action }
          : {
              kind: "job",
              action,
              lease_token: "1".repeat(64),
              ...(action === "heartbeat" ? { lease_seconds: 30 } : {}),
              ...(action === "fail"
                ? { error_code: "handler.failed", retry_at: now.toISOString() }
                : {}),
            }
      expect(
        (await request("/system/deliveries/01900054-0000-7000-8000-000000000003", "PATCH", body))
          .status,
      ).toBe(403)
    }
    expect(await repository.find("job", queued.id)).toMatchObject({ status: "leased", attempt: 1 })
    const failed = leased.fail(accountId, "b".repeat(64), "handler.failed", now, now)
    if (failed instanceof Error) throw failed
    expect(await repository.update(leased, failed, [])).toBe("updated")
    const letters = await repository.findDeadLetters()
    if (letters instanceof Error || letters[0] === undefined) throw new Error("missing dead letter")
    expect(
      (
        await request(`/system/dead-letters/${letters[0].id}/requeue`, "POST", {
          max_attempts: 1,
          available_at: now.toISOString(),
          reason: "retry",
        })
      ).status,
    ).toBe(403)
    expect(await repository.findDeadLetter(letters[0].id)).toMatchObject({ requeuedJobId: null })
  })

  test("Service Principalがjobを冪等登録・lease・dead letterへ進める", async () => {
    const fixture = await SystemSessionTestContext.create()
    await seedWorker(fixture)
    const stepUpToken = await seedSystemStepUpGrant(fixture, accountId, now)
    const accessToken = await issueAccessToken(fixture)
    if (accessToken instanceof Error) return
    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("now", () => now)
        await next()
      })
      .get("/system/deliveries", ...deliveriesGET)
      .post("/system/deliveries", ...deliveriesPOST)
      .patch("/system/deliveries/:deliveryId", ...deliveryPATCH)
      .get("/system/dead-letters", ...deadLettersGET)
      .post("/system/dead-letters/:deadLetterId/requeue", ...deadLetterRequeuePOST)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) => app.request(input, init, { DB: fixture.context.env.DB, JWT_SECRET: jwtSecret })
    const client = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-system-step-up": stepUpToken,
      },
    })

    const created = await client.system.deliveries.$post({
      json: {
        kind: "job",
        id: "01900054-0000-7000-8000-000000000001",
        operation_key: "record.process",
        payload_digest: "a".repeat(64),
        idempotency_key: "command:1",
        max_attempts: 1,
        available_at: now.toISOString(),
      },
    })
    expect(created.status).toBe(201)
    const replayed = await client.system.deliveries.$post({
      json: {
        kind: "job",
        id: "01900054-0000-7000-8000-000000000002",
        operation_key: "record.process",
        payload_digest: "a".repeat(64),
        idempotency_key: "command:1",
        max_attempts: 1,
        available_at: now.toISOString(),
      },
    })
    expect(replayed.status).toBe(200)

    const claimed = await client.system.deliveries[":deliveryId"].$patch({
      param: { deliveryId: "01900054-0000-7000-8000-000000000001" },
      json: { kind: "job", action: "claim", lease_seconds: 30 },
    })
    expect(claimed.status).toBe(200)
    const claimedBody = await claimed.json()
    expect("lease_token" in claimedBody).toBe(true)
    const leaseToken = "lease_token" in claimedBody ? claimedBody.lease_token : undefined
    if (leaseToken === undefined) return
    const failed = await client.system.deliveries[":deliveryId"].$patch({
      param: { deliveryId: "01900054-0000-7000-8000-000000000001" },
      json: {
        kind: "job",
        action: "fail",
        lease_token: leaseToken,
        error_code: "remote.failed",
        retry_at: new Date(now.getTime() + 1_000).toISOString(),
      },
    })
    expect(failed.status).toBe(200)
    expect(await failed.json()).toMatchObject({ delivery: { status: "dead_letter" } })
    const deadLetters = await client.system["dead-letters"].$get()
    expect(deadLetters.status).toBe(200)
    expect(await deadLetters.json()).toMatchObject({
      dead_letters: [
        {
          sourceType: "job",
          sourceId: "01900054-0000-7000-8000-000000000001",
          reasonCode: "remote.failed",
        },
      ],
    })
    const deadLetterBody = await (await client.system["dead-letters"].$get()).json()
    const deadLetterId = deadLetterBody.dead_letters[0]?.id
    if (deadLetterId === undefined) return
    const requeued = await client.system["dead-letters"][":deadLetterId"].requeue.$post({
      param: { deadLetterId },
      json: {
        max_attempts: 3,
        available_at: new Date(now.getTime() + 1_000).toISOString(),
        reason: "operator retry",
      },
    })
    expect(requeued.status).toBe(201)
    const deadLetterReplay = await client.system["dead-letters"][":deadLetterId"].requeue.$post({
      param: { deadLetterId },
      json: {
        max_attempts: 3,
        available_at: new Date(now.getTime() + 1_000).toISOString(),
        reason: "operator retry",
      },
    })
    expect(deadLetterReplay.status).toBe(200)
    expect(
      await fixture.database
        .prepare(`SELECT count(*) AS total FROM system_audit_events
           WHERE action = 'system.dead_letter.requeued'`)
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 1 })
  })
})

async function seedWorker(fixture: SystemSessionTestContext): Promise<void> {
  await fixture.database
    .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`)
    .bind(accountId, now.getTime())
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_principals
         (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
       VALUES ('ef083a4f-dd0a-42a8-8007-57ab6f2df095', ?1, 'service', 'Worker', NULL, 1, ?2, ?2)`)
    .bind(accountId, now.getTime())
    .run()
  await execSql(
    fixture.database,
    `INSERT INTO system_iam_roles
       (id, key, kind, name, created_at, updated_at)
     VALUES ('fcc965d5-8be4-4a24-86fe-4453fb422bde', 'system:delivery', 'managed', 'Delivery', 1, 1);
     INSERT INTO system_iam_role_permissions (role_id, permission_key)
     VALUES ('fcc965d5-8be4-4a24-86fe-4453fb422bde', 'batch:view'),
            ('fcc965d5-8be4-4a24-86fe-4453fb422bde', 'batch:write'),
            ('fcc965d5-8be4-4a24-86fe-4453fb422bde', 'batch:execute'),
            ('fcc965d5-8be4-4a24-86fe-4453fb422bde', 'system:admin');
     INSERT INTO system_role_bindings
       (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
     VALUES ('5e19b6cc-dac5-433f-87a3-baa7ca288d35', '37d00139-429b-4419-97c9-2def4b6e1ffe', 'fcc965d5-8be4-4a24-86fe-4453fb422bde', NULL, NULL, 1, NULL);`,
  )
}

async function issueAccessToken(fixture: SystemSessionTestContext): Promise<string | Error> {
  const rawSecret = "1".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(rawSecret)
  if (hash instanceof Error) throw hash
  await fixture.database
    .prepare(`INSERT INTO system_machine_credentials
    (id, principal_id, name, secret_hash, status, created_at, updated_at)
    VALUES ('36f370ec-f11f-45ab-b977-fb143f8c0428', 'ef083a4f-dd0a-42a8-8007-57ab6f2df095', 'Primary', ?1, 'active', ?2, ?2)`)
    .bind(hash, now.getTime())
    .run()
  const app = systemFactory.createApp().post("/system/machine-sessions", ...machineSessionPOST)
  const response = await app.request(
    "/system/machine-sessions",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        credential_id: "36f370ec-f11f-45ab-b977-fb143f8c0428",
        secret: rawSecret,
      }),
    },
    { DB: fixture.context.env.DB, JWT_SECRET: jwtSecret, NOW: now.toISOString() },
  )
  expect(response.status).toBe(201)
  return z.object({ access_token: z.string() }).parse(await response.json()).access_token
}

async function requeueMutationFixture(shortStepUp = false) {
  const fixture = await SystemSessionTestContext.create()
  await seedWorker(fixture)
  const at = new Date()
  const actor = zAccountId.parse("c08ec37d-0fe5-4282-9670-5ca99e6ad604")
  await fixture.database.batch([
    fixture.database
      .prepare(
        "INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES (?1,'active',0,?2,?2)",
      )
      .bind(actor, at.getTime() - 600_000),
    fixture.database
      .prepare(
        "INSERT INTO system_role_bindings(id,account_id,role_id,resource_type,resource_id,created_at) VALUES (?1,?2,'fcc965d5-8be4-4a24-86fe-4453fb422bde',NULL,NULL,1)",
      )
      .bind(crypto.randomUUID(), actor),
  ])
  const applications = createSystemSessionApplications({
    context: fixture.context,
    jwtSecret,
    sessionTtlMilliseconds: 604_800_000,
  })
  if (applications instanceof Error) throw applications
  const session = await applications.issue.execute({
    accountId: actor,
    tokenVersion: 0,
    now: at,
    auditContext: { authorizationJson: null, metadataJson: null },
  })
  if (session instanceof Error || session.kind === "rejected")
    throw new Error("test session issuance failed")
  const stepUp = await seedSystemStepUpGrant(
    fixture,
    actor,
    shortStepUp ? new Date(at.getTime() - 299_000) : at,
  )
  const queued = SystemDeliveryEntity.create({
    id: crypto.randomUUID(),
    kind: "job",
    operationKey: "example.retry",
    payloadDigest: "a".repeat(64),
    idempotencyKey: "example-retry",
    status: "queued",
    attempt: 0,
    maxAttempts: 1,
    availableAt: at,
    leaseAccountId: null,
    leaseTokenHash: null,
    leaseExpiresAt: null,
    lastErrorCode: null,
    createdAt: at,
    updatedAt: at,
    completedAt: null,
  })
  if (queued instanceof Error) throw queued
  const repository = new SystemDeliveryRepository(fixture.context)
  expect(await repository.create(queued, actor, null, [])).toBe("created")
  const leased = queued.claim(actor, "b".repeat(64), at, 30_000)
  if (leased instanceof Error) throw leased
  expect(await repository.update(queued, leased, [])).toBe("updated")
  const failed = leased.fail(actor, "b".repeat(64), "example.failed", at, at)
  if (failed instanceof Error) throw failed
  expect(await repository.update(leased, failed, [])).toBe("updated")
  const letters = await repository.findDeadLetters()
  if (letters instanceof Error || !letters[0]) throw new Error("missing test dead letter")
  const id = letters[0].id
  const app = systemFactory
    .createApp()
    .use("*", async (c, next) => {
      c.set("now", () => at)
      await next()
    })
    .post("/system/dead-letters/:deadLetterId/requeue", ...deadLetterRequeuePOST)
    .post(
      "/empty-permissions",
      authenticateSystemAccessToken,
      requireSystemStepUp,
      async (context) => {
        const proof = await prepareSystemWriteAuthorization(context, {
          now: at,
          requiredPermissions: [],
          stepUpToken: stepUp,
        })
        return context.json({ forbidden: proof === "forbidden" }, proof === "forbidden" ? 403 : 500)
      },
    )
  const request = (path = `/system/dead-letters/${id}/requeue`) =>
    app.request(
      path,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          "x-system-step-up": stepUp,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          max_attempts: 1,
          available_at: at.toISOString(),
          reason: "Test retry",
        }),
      },
      { DB: fixture.database, JWT_SECRET: jwtSecret },
    )
  const snapshot = () =>
    fixture.database
      .prepare(`SELECT (SELECT count(*) FROM system_jobs) AS jobs,
    (SELECT group_concat(requeued_job_id) FROM system_dead_letters) AS requeued,
    (SELECT count(*) FROM system_audit_events) AS audits`)
      .first<Record<string, unknown>>()
  return { database: fixture.database, request, snapshot, id }
}

type RequeueMutationCase = Readonly<{
  replay: boolean
  change: "logout" | "authority" | "step-up" | "version" | "expiry"
}>
const requeueMutationCases: ReadonlyArray<RequeueMutationCase> = [
  { replay: false, change: "logout" },
  { replay: true, change: "logout" },
  { replay: false, change: "authority" },
  { replay: false, change: "step-up" },
  { replay: false, change: "version" },
  { replay: false, change: "expiry" },
]
for (const scenario of requeueMutationCases) {
  const replay = scenario.replay
  test(`dead letter再投入は途中${scenario.change}で状態と成功監査を変えない: ${replay}`, async () => {
    const f = await requeueMutationFixture(scenario.change === "expiry")
    if (replay) expect((await f.request()).status).toBe(201)
    const before = await f.snapshot()
    const requeue = spyOn(SystemDeliveryRepository.prototype, "requeueDeadLetter")
    const find = spyOn(SystemDeliveryRepository.prototype, "find")
    const originalRequeue = requeue.getMockImplementation()
    const originalFind = find.getMockImplementation()
    if (!originalRequeue || !originalFind) throw new Error("missing original delivery methods")
    const revoke = async () => {
      if (scenario.change === "authority") {
        await f.database
          .prepare("DELETE FROM system_iam_role_permissions WHERE permission_key='system:admin'")
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
          .prepare(
            "UPDATE system_accounts SET token_version=token_version+1 WHERE id='c08ec37d-0fe5-4282-9670-5ca99e6ad604'",
          )
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
    requeue.mockImplementation(async function (this: SystemDeliveryRepository, ...args) {
      if (!replay) await revoke()
      return originalRequeue.call(this, ...args)
    })
    find.mockImplementation(async function (this: SystemDeliveryRepository, ...args) {
      if (replay) await revoke()
      return originalFind.call(this, ...args)
    })
    try {
      expect({ status: (await f.request()).status, snapshot: await f.snapshot() }).toEqual({
        status: 403,
        snapshot: before,
      })
    } finally {
      requeue.mockRestore()
      find.mockRestore()
    }
  })
}

test("再投入transaction中のlogoutでjob・再投入記録・監査を全て巻き戻す", async () => {
  const f = await requeueMutationFixture()
  const before = await f.snapshot()
  await f.database
    .prepare(
      `CREATE TRIGGER revoke_requeue_session AFTER INSERT ON system_jobs BEGIN UPDATE system_sessions SET revoked_at=${Date.now()}; END`,
    )
    .run()
  expect((await f.request()).status).toBe(403)
  expect(await f.snapshot()).toEqual(before)
})

test("現在の資格での再送はjobと成功監査を重複させない", async () => {
  const f = await requeueMutationFixture()
  expect((await f.request()).status).toBe(201)
  const before = await f.snapshot()
  expect((await f.request()).status).toBe(200)
  expect(await f.snapshot()).toEqual(before)
})

test("空の要求permissionは権限検査を省略せず拒否する", async () => {
  const f = await requeueMutationFixture()
  expect((await f.request("/empty-permissions")).status).toBe(403)
})
