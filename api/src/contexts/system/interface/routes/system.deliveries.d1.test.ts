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
import { HTTPException } from "hono/http-exception"
import { PATCH as inboxPATCH } from "@system/interface/routes/system.inbox-messages.$messageId"
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
    expect(await repository.create(queued, accountId, null, [])).toMatchObject({
      status: "created",
    })
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
    const replayBody = await replayed.json()
    if (!("delivery" in replayBody)) throw new Error("missing replay delivery")
    expect(replayBody.delivery.id).toBe("01900054-0000-7000-8000-000000000001")

    const claimed = await client.system.deliveries[":deliveryId"].$patch({
      param: { deliveryId: replayBody.delivery.id },
      json: { kind: "job", action: "claim", lease_seconds: 30 },
    })
    expect(claimed.status).toBe(200)
    const claimedBody = await claimed.json()
    expect("lease_token" in claimedBody).toBe(true)
    const leaseToken = "lease_token" in claimedBody ? claimedBody.lease_token : undefined
    if (leaseToken === undefined) return
    const failed = await client.system.deliveries[":deliveryId"].$patch({
      param: { deliveryId: replayBody.delivery.id },
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
    const terminalReplay = await client.system.deliveries.$post({
      json: {
        kind: "job",
        id: crypto.randomUUID(),
        operation_key: "record.process",
        payload_digest: "a".repeat(64),
        idempotency_key: "command:1",
        max_attempts: 1,
        available_at: now.toISOString(),
      },
    })
    expect(terminalReplay.status).toBe(200)
    expect(await terminalReplay.json()).toMatchObject({
      delivery: { id: replayBody.delivery.id, status: "dead_letter", attempt: 1 },
      replayed: true,
    })
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
  for (const kind of ["job", "outbox"] as const) {
    test(`${kind}の別ID・期限後・lease後・完了後の再送は保存済み実体を返す`, async () => {
      const fixture = await createHttpFixture()
      const id = crypto.randomUUID()
      const body = deliveryBody(kind, id)
      const created = await fixture.request("/system/deliveries", "POST", body)
      expect(created.status).toBe(201)
      const initial = await deliveryJson(created)
      fixture.setNow(new Date(now.getTime() + 1_000))
      const sameBodyReplay = await fixture.request("/system/deliveries", "POST", body)
      expect(sameBodyReplay.status).toBe(200)
      expect(await deliveryJson(sameBodyReplay)).toEqual({ ...initial, replayed: true })
      const replay = await fixture.request("/system/deliveries", "POST", {
        ...body,
        id: crypto.randomUUID(),
      })
      expect(replay.status).toBe(200)
      const replayResult = await deliveryJson(replay)
      expect(replayResult).toEqual({ ...initial, replayed: true })
      const claimed = await fixture.request(
        `/system/deliveries/${replayResult.delivery.id}`,
        "PATCH",
        {
          kind,
          action: "claim",
          lease_seconds: 30,
        },
      )
      expect(claimed.status).toBe(200)
      const lease = await deliveryJson(claimed)
      const leasedReplay = await fixture.request("/system/deliveries", "POST", body)
      expect(leasedReplay.status).toBe(200)
      expect(await deliveryJson(leasedReplay)).toEqual({ delivery: lease.delivery, replayed: true })
      const completed = await fixture.request(`/system/deliveries/${lease.delivery.id}`, "PATCH", {
        kind,
        action: "succeed",
        lease_token: lease.lease_token,
      })
      expect(completed.status).toBe(200)
      const completion = await deliveryJson(completed)
      const completedReplay = await fixture.request("/system/deliveries", "POST", body)
      expect(completedReplay.status).toBe(200)
      expect(await deliveryJson(completedReplay)).toEqual({
        delivery: completion.delivery,
        replayed: true,
      })
      expect(
        (
          await fixture.request("/system/deliveries", "POST", {
            ...body,
            payload_digest: "b".repeat(64),
          })
        ).status,
      ).toBe(409)
      expect(
        (
          await fixture.request("/system/deliveries", "POST", {
            ...body,
            id: crypto.randomUUID(),
            idempotency_key: "new:past",
          })
        ).status,
      ).toBe(400)
      const table = kind === "job" ? "system_jobs" : "system_outbox_messages"
      expect(
        await fixture.database
          .prepare(`SELECT count(*) AS total FROM ${table}`)
          .first<Record<string, unknown>>(),
      ).toEqual({ total: 1 })
      expect(
        await fixture.database
          .prepare("SELECT count(*) AS total FROM system_audit_events WHERE action = ?1")
          .bind(kind === "job" ? "system.job.queued" : "system.outbox.queued")
          .first<Record<string, unknown>>(),
      ).toEqual({ total: 1 })
      const managed = SystemDeliveryEntity.create({
        id: crypto.randomUUID(),
        kind,
        operationKey: "record.process",
        handlerKey: "record.handler",
        payloadDigest: "a".repeat(64),
        idempotencyKey: "command:handler",
        status: "queued",
        attempt: 0,
        maxAttempts: 3,
        availableAt: now,
        createdAt: now,
        updatedAt: now,
        leaseAccountId: null,
        leaseTokenHash: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
        completedAt: null,
      })
      if (managed instanceof Error) throw managed
      const repository = new SystemDeliveryRepository({ env: { DB: fixture.database } })
      expect(
        await repository.create(
          managed,
          accountId,
          kind === "outbox"
            ? {
                topic: "record.process",
                sourceContext: "example",
                sourceKind: "record",
                sourceId: "record:1",
                sourceVersion: "1",
              }
            : null,
          [],
        ),
      ).toMatchObject({ status: "created" })
      expect(
        (
          await fixture.request("/system/deliveries", "POST", {
            ...body,
            idempotency_key: "command:handler",
          })
        ).status,
      ).toBe(409)
      await fixture.database
        // 全権限を持つ管理者の権限も一緒に外す。残すと、対象の権限が無くても登録を通してしまう。
        .prepare(
          "DELETE FROM system_iam_role_permissions WHERE permission_key IN (?1, 'system:admin')",
        )
        .bind(kind === "job" ? "batch:write" : "integration:write")
        .run()
      expect((await fixture.request("/system/deliveries", "POST", body)).status).toBe(403)
    })

    test(`${kind}の並行登録後の再照合は保存済みIDを返す`, async () => {
      const fixture = await createHttpFixture()
      const body = deliveryBody(kind, crypto.randomUUID())
      const restore = synchronizeCreationBatches(fixture.database)
      try {
        const responses = await Promise.all([
          fixture.request("/system/deliveries", "POST", body),
          fixture.request("/system/deliveries", "POST", { ...body, id: crypto.randomUUID() }),
        ])
        expect(responses.map((response) => response.status).sort()).toEqual([200, 201])
        const results = await Promise.all(responses.map((response) => deliveryJson(response)))
        expect(results[0].delivery).toEqual(results[1].delivery)
        expect(
          await fixture.database
            .prepare("SELECT count(*) AS total FROM system_audit_events WHERE action = ?1")
            .bind(kind === "job" ? "system.job.queued" : "system.outbox.queued")
            .first<Record<string, unknown>>(),
        ).toEqual({ total: 1 })
      } finally {
        restore()
      }
    })
  }

  for (const differentDigest of [false, true]) {
    test(`inboxの事前SELECTを両要求が通る並行受信は${differentDigest ? "409" : "保存済みID"}へ収束する`, async () => {
      const fixture = await createHttpFixture()
      const body = {
        kind: "inbox",
        id: crypto.randomUUID(),
        source_key: "source.messages",
        external_message_id: "external:concurrent",
        payload_digest: "a".repeat(64),
        idempotency_key: "inbox:concurrent",
        received_at: now.toISOString(),
      }
      const restore = synchronizeCreationBatches(fixture.database)
      let savedId: string
      try {
        const responses = await Promise.all([
          fixture.request("/system/deliveries", "POST", body),
          fixture.request("/system/deliveries", "POST", {
            ...body,
            id: crypto.randomUUID(),
            payload_digest: (differentDigest ? "b" : "a").repeat(64),
          }),
        ])
        expect(responses.map((response) => response.status).sort()).toEqual(
          differentDigest ? [201, 409] : [200, 201],
        )
        const accepted = responses.find((response) => response.status === 201)
        if (accepted === undefined) throw new Error("missing accepted response")
        savedId = (await inboxJson(accepted)).id
        if (!differentDigest) {
          const replay = responses.find((response) => response.status === 200)
          if (replay === undefined) throw new Error("missing replay response")
          expect(await inboxJson(replay)).toEqual({ id: savedId, kind: "inbox", replayed: true })
        }
      } finally {
        restore()
      }
      expect(
        await fixture.database
          .prepare("SELECT count(*) AS total FROM system_inbox_messages")
          .first<Record<string, unknown>>(),
      ).toEqual({ total: 1 })
      expect(
        await fixture.database
          .prepare(
            "SELECT count(*) AS total FROM system_audit_events WHERE action = 'system.inbox.accepted'",
          )
          .first<Record<string, unknown>>(),
      ).toEqual({ total: 1 })
      const saved = await fixture.database
        .prepare("SELECT payload_digest FROM system_inbox_messages WHERE id = ?1")
        .bind(savedId)
        .first<{ payload_digest: string }>()
      if (saved === null) throw new Error("missing inbox")
      const replay = await fixture.request("/system/deliveries", "POST", {
        ...body,
        id: crypto.randomUUID(),
        payload_digest: saved.payload_digest,
      })
      expect(replay.status).toBe(200)
      const replayBody = await inboxJson(replay)
      expect(replayBody.id).toBe(savedId)
      expect(
        (
          await fixture.request(`/system/inbox-messages/${replayBody.id}`, "PATCH", {
            outcome: differentDigest ? "rejected" : "processed",
            ...(differentDigest ? { reason_code: "remote.invalid" } : {}),
          })
        ).status,
      ).toBe(204)
    })
  }

  test("inboxの無関係なDB障害は503のままで受信と監査を保存しない", async () => {
    const fixture = await createHttpFixture()
    const failure = spyOn(fixture.database, "batch").mockRejectedValue(
      new Error("database unavailable"),
    )
    try {
      const response = await fixture.request("/system/deliveries", "POST", {
        kind: "inbox",
        id: crypto.randomUUID(),
        source_key: "source.messages",
        external_message_id: "external:failed",
        payload_digest: "a".repeat(64),
        idempotency_key: "inbox:failed",
        received_at: now.toISOString(),
      })
      expect(response.status).toBe(503)
      expect(
        await fixture.database
          .prepare("SELECT count(*) AS total FROM system_inbox_messages")
          .first<Record<string, unknown>>(),
      ).toEqual({ total: 0 })
      expect(
        await fixture.database
          .prepare(
            "SELECT count(*) AS total FROM system_audit_events WHERE action = 'system.inbox.accepted'",
          )
          .first<Record<string, unknown>>(),
      ).toEqual({ total: 0 })
    } finally {
      failure.mockRestore()
    }
  })
  for (const kind of ["job", "outbox"] as const) {
    test(`${kind}の監査batch失敗は配送と監査を部分保存しない`, async () => {
      const fixture = await createHttpFixture()
      const batch = fixture.database.batch.bind(fixture.database)
      const failure = spyOn(fixture.database, "batch").mockImplementation((statements) =>
        batch([
          ...statements,
          fixture.database.prepare("INSERT INTO missing_audit_table (id) VALUES ('failed')"),
        ]),
      )
      try {
        expect(
          (
            await fixture.request(
              "/system/deliveries",
              "POST",
              deliveryBody(kind, crypto.randomUUID()),
            )
          ).status,
        ).toBe(503)
        const table = kind === "job" ? "system_jobs" : "system_outbox_messages"
        expect(
          await fixture.database
            .prepare(`SELECT count(*) AS total FROM ${table}`)
            .first<Record<string, unknown>>(),
        ).toEqual({ total: 0 })
        expect(
          await fixture.database
            .prepare("SELECT count(*) AS total FROM system_audit_events WHERE action = ?1")
            .bind(kind === "job" ? "system.job.queued" : "system.outbox.queued")
            .first<Record<string, unknown>>(),
        ).toEqual({ total: 0 })
      } finally {
        failure.mockRestore()
      }
    })
  }
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
            ('fcc965d5-8be4-4a24-86fe-4453fb422bde', 'integration:write'),
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

async function createHttpFixture() {
  const fixture = await SystemSessionTestContext.create()
  await seedWorker(fixture)
  const stepUpToken = await seedSystemStepUpGrant(fixture, accountId, now)
  const accessToken = await issueAccessToken(fixture)
  if (accessToken instanceof Error) throw accessToken
  let currentNow = now
  const app = systemFactory
    .createApp()
    .onError((error, context) =>
      context.json({ message: error.message }, error instanceof HTTPException ? error.status : 500),
    )
    .use("*", async (context, next) => {
      context.set("now", () => currentNow)
      await next()
    })
    .post("/system/deliveries", ...deliveriesPOST)
    .patch("/system/deliveries/:deliveryId", ...deliveryPATCH)
    .patch("/system/inbox-messages/:messageId", ...inboxPATCH)
  return {
    database: fixture.database,
    setNow: (at: Date) => {
      currentNow = at
    },
    request: (path: string, method: string, body: unknown) =>
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
      ),
  }
}

function deliveryBody(kind: "job" | "outbox", id: string) {
  return {
    kind,
    id,
    payload_digest: "a".repeat(64),
    idempotency_key: "command:replay",
    max_attempts: 3,
    available_at: now.toISOString(),
    ...(kind === "job"
      ? { operation_key: "record.process" }
      : {
          topic: "record.process",
          source_context: "example",
          source_kind: "record",
          source_id: "record:1",
          source_version: "1",
        }),
  }
}

function synchronizeCreationBatches(database: D1Database): () => void {
  const batch = database.batch.bind(database)
  let arrivals = 0
  let release: () => void = () => {
    throw new Error("barrier not initialized")
  }
  const barrier = new Promise<void>((resolve) => {
    release = resolve
  })
  const synchronized = spyOn(database, "batch").mockImplementation(async (statements) => {
    // 両要求がINSERT直前へ到達するまで待ち、事前SELECTが両方とも空を返す順序を固定する。
    arrivals += 1
    if (arrivals === 2) release()
    await barrier
    return batch(statements)
  })
  return () => synchronized.mockRestore()
}

async function deliveryJson(response: Response) {
  return z
    .object({
      delivery: z.object({ id: z.uuid() }).passthrough(),
      replayed: z.boolean().optional(),
      lease_token: z.string().optional(),
    })
    .parse(await response.json())
}

async function inboxJson(response: Response) {
  return z
    .object({ id: z.uuid(), kind: z.literal("inbox"), replayed: z.boolean() })
    .parse(await response.json())
}
