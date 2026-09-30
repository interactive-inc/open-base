import { testDerivedId } from "@system/test/system-test-id.test-support"
import { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import { expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { StoreAttachment } from "@system/application/attachments/store-attachment"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { AttachmentPreservationRepository } from "@system/infrastructure/repositories/attachments/attachment-preservation.repository"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { GET, POST } from "@system/interface/routes/system.attachments.$attachmentId.preservations"
import { POST as RELEASE } from "@system/interface/routes/system.attachments.$attachmentId.preservations.$preservationId.release"
import { POST as PURGE } from "@system/interface/routes/system.attachments.purge-unlinked"
import {
  attachmentPreservationResponseSchema,
  attachmentPreservationListResponseSchema,
} from "@system/interface/http/attachment-preservation-response-schemas"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const at = new Date("2026-08-21T09:00:00.000Z")
const old = new Date(at.getTime() - 2 * 24 * 60 * 60 * 1000)

async function responseJson(response: Response): Promise<unknown> {
  return response.json()
}

async function fixture() {
  const db = await createSystemAttachmentTestDatabase()
  const database = drizzle(db)
  const clock = { now: at }
  for (const id of [
    "282b84eb-787d-4655-a88b-c072960fc970",
    "40aa61aa-631f-473e-9cff-0db7c56ad714",
  ]) {
    await db
      .prepare(
        "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES (?1, 'active', 0, ?2, ?2)",
      )
      .bind(id, old.getTime())
      .run()
    await db
      .prepare(
        "INSERT INTO system_principals (id, account_id, kind, name, revision, created_at, updated_at) VALUES (?1, ?2, 'human', 'Test principal', 1, ?3, ?3)",
      )
      .bind(testDerivedId("principal", id), id, old.getTime())
      .run()
  }
  await db
    .prepare(
      "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES ('be72ba18-7abe-47f1-8371-b41cff620297', 'system:root', 'managed', 'Root', ?1, ?1)",
    )
    .bind(old.getTime())
    .run()
  await db
    .prepare(
      "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('be72ba18-7abe-47f1-8371-b41cff620297', 'system:admin')",
    )
    .run()
  await db
    .prepare(
      "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('09ef108e-50f8-4909-8969-532bd57c6cc9', '282b84eb-787d-4655-a88b-c072960fc970', 'be72ba18-7abe-47f1-8371-b41cff620297', NULL, NULL, ?1)",
    )
    .bind(old.getTime())
    .run()
  const bucket = new SystemAttachmentTestBucket()
  const app = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => clock.now)
      context.set("database", database)
      await next()
    })
    .get("/system/attachments/:attachmentId/preservations", ...GET)
    .post("/system/attachments/:attachmentId/preservations", ...POST)
    .post("/system/attachments/:attachmentId/preservations/:preservationId/release", ...RELEASE)
    .post("/system/attachments/purge-unlinked", ...PURGE)
  const jwtSecret = "attachment-preservation-test-secret"
  const applications = createSystemSessionApplications({
    context: { env: { DB: db } },
    jwtSecret,
    sessionTtlMilliseconds: 604_800_000,
  })
  if (applications instanceof Error) throw applications
  const attachment = await new StoreAttachment({
    var: { database },
    env: {
      ATTACHMENTS: bucket as unknown as R2Bucket,
      ATTACHMENT_KEKS: createSystemAttachmentTestKekEnvironment(1),
    },
  }).run({
    ownerAccountId: "40aa61aa-631f-473e-9cff-0db7c56ad714",
    fileName: "evidence.pdf",
    contentType: "application/pdf",
    content: new TextEncoder().encode("%PDF-1.7 evidence"),
    now: old,
  })
  if (attachment instanceof Error) throw attachment
  const headers = async (id = "282b84eb-787d-4655-a88b-c072960fc970") => {
    const issuance = await applications.issue.execute({
      accountId: zAccountId.parse(id),
      tokenVersion: 0,
      now: new Date(),
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    if (issuance instanceof Error || issuance.kind === "rejected")
      throw new Error("test token issuance failed")
    const secret = new SystemPrincipalSecretService()
    const raw = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "")
    const hash = await secret.hashRawSecret(raw)
    if (hash instanceof Error) throw hash
    await db
      .prepare(
        "INSERT INTO system_step_up_grants (id, account_id, token_hash, method, issued_at, expires_at) VALUES (?1, ?2, ?3, 'password', ?4, ?5)",
      )
      .bind(crypto.randomUUID(), id, hash, clock.now.getTime(), clock.now.getTime() + 300_000)
      .run()
    return {
      authorization: `Bearer ${issuance.accessToken}`,
      "x-system-step-up": raw,
      "content-type": "application/json",
    }
  }
  const request = async (path: string, init: RequestInit) =>
    app.request(path, init, {
      DB: db,
      JWT_SECRET: jwtSecret,
      ATTACHMENTS: bucket as unknown as R2Bucket,
    })
  const endpoint = `/system/attachments/${attachment.id}/preservations`
  const command = (kind: "hold" | "retention" = "hold") => ({
    id: crypto.randomUUID(),
    sha256: attachment.plaintextSha256,
    kind,
    retainUntil: kind === "retention" ? new Date(at.getTime() + 1000).toISOString() : null,
    reason: "Evidence review",
  })
  return {
    db,
    bucket,
    attachment,
    clock,
    headers,
    request,
    endpoint,
    command,
    attachments: new AttachmentAdapter({ var: { database } }),
    create: async (body: unknown, actor = "282b84eb-787d-4655-a88b-c072960fc970") =>
      request(endpoint, {
        method: "POST",
        headers: await headers(actor),
        body: JSON.stringify(body),
      }),
    purge: async () =>
      request("/system/attachments/purge-unlinked", { method: "POST", headers: await headers() }),
    release: async (id: string, operationId = crypto.randomUUID()) =>
      request(`${endpoint}/${id}/release`, {
        method: "POST",
        headers: await headers(),
        body: JSON.stringify({ operationId, expectedRevision: 1, reason: "Review completed" }),
      }),
  }
}

test("複数の削除停止を個別に解除し、最後の保全がなくなるまで本体を残す", async () => {
  const c = await fixture()
  await c.db
    .prepare("CREATE TABLE test_original_attachment AS SELECT * FROM system_attachments")
    .run()
  const first = c.command()
  const second = c.command()
  expect((await c.create(first)).status).toBe(201)
  expect((await c.create(second)).status).toBe(201)
  expect(await responseJson(await c.purge())).toEqual({ purged_count: 0 })
  expect((await c.release(first.id)).status).toBe(200)
  expect(await responseJson(await c.purge())).toEqual({ purged_count: 0 })
  expect(c.bucket.size()).toBe(1)
  expect((await c.release(second.id)).status).toBe(200)
  expect(await responseJson(await c.purge())).toEqual({ purged_count: 1 })
  expect(c.bucket.size()).toBe(0)
  expect(
    await c.db
      .prepare("INSERT INTO system_attachments SELECT * FROM test_original_attachment")
      .run()
      .catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  const page = await c.request(c.endpoint, { method: "GET", headers: await c.headers() })
  const records = attachmentPreservationListResponseSchema.parse(await page.json())
  expect(records.preservations).toHaveLength(2)
  expect(
    records.preservations.every((record) => record.revision === 2 && record.release !== null),
  ).toBe(true)
  const audit = await c.db
    .prepare(
      "SELECT count(*) AS count FROM system_audit_events WHERE action LIKE 'system.attachment.preservation.%'",
    )
    .first<Record<string, unknown>>()
  expect(audit).toEqual({ count: 4 })
})

test("期限の保全は解除できず、期限直前まで残して期限ちょうどで回収する", async () => {
  const c = await fixture()
  const command = c.command("retention")
  expect((await c.create(command)).status).toBe(201)
  expect((await c.release(command.id)).status).toBe(409)
  c.clock.now = new Date(at.getTime() + 999)
  expect(await responseJson(await c.purge())).toEqual({ purged_count: 0 })
  c.clock.now = new Date(at.getTime() + 1000)
  expect(await responseJson(await c.purge())).toEqual({ purged_count: 1 })
  const replay = await c.create(command)
  expect(replay.status).toBe(200)
  expect(attachmentPreservationResponseSchema.parse(await replay.json()).replayed).toBe(true)
})

test("登録・解除の再送は同じ内容だけを受け付け、監査を重複させない", async () => {
  const c = await fixture()
  const command = c.command()
  expect((await c.create(command)).status).toBe(201)
  const replay = await c.create(command)
  expect(replay.status).toBe(200)
  expect(attachmentPreservationResponseSchema.parse(await replay.json()).replayed).toBe(true)
  expect((await c.create({ ...command, reason: "different" })).status).toBe(409)
  const operation = crypto.randomUUID()
  expect((await c.release(command.id, operation)).status).toBe(200)
  const released = await c.release(command.id, operation)
  expect(attachmentPreservationResponseSchema.parse(await released.json()).replayed).toBe(true)
  expect((await c.release(command.id)).status).toBe(409)
  const afterRelease = await c.create(command)
  expect(
    attachmentPreservationResponseSchema.parse(await afterRelease.json()).preservation.release,
  ).not.toBeNull()
  expect(
    await c.db
      .prepare(
        "SELECT count(*) AS count FROM system_audit_events WHERE action LIKE 'system.attachment.preservation.%'",
      )
      .first<Record<string, unknown>>(),
  ).toEqual({ count: 2 })
})

test("人・権限・再認証・内容digest・期間を検査する", async () => {
  const c = await fixture()
  expect((await c.create(c.command(), "40aa61aa-631f-473e-9cff-0db7c56ad714")).status).toBe(403)
  const headers = await c.headers()
  expect(
    (
      await c.request(c.endpoint, {
        method: "POST",
        headers: { authorization: headers.authorization, "content-type": "application/json" },
        body: JSON.stringify(c.command()),
      })
    ).status,
  ).toBe(403)
  expect((await c.create({ ...c.command(), sha256: "b".repeat(64) })).status).toBe(409)
  expect(
    (await c.create({ ...c.command("retention"), retainUntil: at.toISOString() })).status,
  ).toBe(400)
  await c.db
    .prepare(
      "UPDATE system_principals SET kind = 'agent', revision = revision + 1 WHERE account_id = '282b84eb-787d-4655-a88b-c072960fc970'",
    )
    .run()
  expect((await c.create(c.command())).status).toBe(401)
  expect(
    await c.db
      .prepare("SELECT count(*) AS count FROM system_attachment_preservations")
      .first<Record<string, unknown>>(),
  ).toEqual({ count: 0 })
})

test("掃除の候補走査後に保全が入れば本体を消さない", async () => {
  const c = await fixture()
  const original = c.attachments.listStaleUnlinked.bind(c.attachments)
  const scan = spyOn(AttachmentAdapter.prototype, "listStaleUnlinked").mockImplementation(
    async (threshold, limit, now) => {
      const rows = await original(threshold, limit, now)
      expect((await c.create(c.command())).status).toBe(201)
      return rows
    },
  )
  try {
    expect(await responseJson(await c.purge())).toEqual({ purged_count: 0 })
    expect(c.bucket.size()).toBe(1)
  } finally {
    scan.mockRestore()
  }
})

test("削除が始まった添付には保全を付けたと回答しない", async () => {
  const c = await fixture()
  expect(
    await c.attachments.claimUnlinkedPurge(
      c.attachment.id,
      new Date(at.getTime() - 24 * 60 * 60 * 1000),
      at,
    ),
  ).not.toBeNull()
  expect((await c.create(c.command())).status).toBe(409)
  expect(
    await c.db
      .prepare("SELECT count(*) AS count FROM system_attachment_preservations")
      .first<Record<string, unknown>>(),
  ).toEqual({ count: 0 })
})

test("DBからの削除・鍵破棄・内容差し替え・保全履歴改変も拒否する", async () => {
  const c = await fixture()
  expect((await c.create(c.command())).status).toBe(201)
  for (const sql of [
    "DELETE FROM system_attachments",
    "UPDATE system_attachments SET status = 'erased', wrapped_dek = NULL",
    "UPDATE system_attachments SET object_key = 'att/changed'",
    "UPDATE system_attachments SET wrapped_dek = 'changed'",
    "DELETE FROM system_attachment_preservations",
    "UPDATE system_attachment_preservations SET reason = 'changed'",
    "UPDATE system_attachment_preservations SET revision = 2, release_operation_id = 'unverified'",
  ])
    expect(
      await c.db
        .prepare(sql)
        .run()
        .catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
  expect(c.bucket.size()).toBe(1)
  expect(await c.attachments.markLinked(c.attachment.id, at)).toBeUndefined()
})

test("監査保存に失敗した登録と解除を巻き戻す", async () => {
  const c = await fixture()
  const command = c.command()
  await c.db
    .prepare(
      "CREATE TRIGGER test_reject_preservation_audit BEFORE INSERT ON system_audit_events WHEN NEW.action LIKE 'system.attachment.preservation.%' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    )
    .run()
  expect((await c.create(command)).status).toBe(503)
  expect(
    await c.db
      .prepare("SELECT count(*) AS count FROM system_attachment_preservations")
      .first<Record<string, unknown>>(),
  ).toEqual({ count: 0 })
  await c.db.prepare("DROP TRIGGER test_reject_preservation_audit").run()
  expect((await c.create(command)).status).toBe(201)
  await c.db
    .prepare(
      "CREATE TRIGGER test_reject_preservation_audit BEFORE INSERT ON system_audit_events WHEN NEW.action LIKE 'system.attachment.preservation.%' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    )
    .run()
  expect((await c.release(command.id)).status).toBe(503)
  expect(
    await c.db
      .prepare("SELECT revision, released_at FROM system_attachment_preservations")
      .first<Record<string, unknown>>(),
  ).toEqual({ revision: 1, released_at: null })
})

test("準備後の権限失効は保全保存と監査を一緒に拒否する", async () => {
  const c = await fixture()
  // oxlint-disable-next-line typescript/unbound-method -- 呼出し元のthisを保ち、保存直前へ失効を挿入する。
  const original = AttachmentPreservationRepository.prototype.write
  const write = spyOn(AttachmentPreservationRepository.prototype, "write").mockImplementation(
    async function (this: AttachmentPreservationRepository, entity, audit) {
      await c.db
        .prepare("DELETE FROM system_iam_role_permissions WHERE permission_key = 'system:admin'")
        .run()
      return original.call(this, entity, audit)
    },
  )
  try {
    expect((await c.create(c.command())).status).toBe(403)
    expect(
      await c.db
        .prepare("SELECT count(*) AS count FROM system_attachment_preservations")
        .first<Record<string, unknown>>(),
    ).toEqual({ count: 0 })
    expect(
      await c.db
        .prepare(
          "SELECT count(*) AS count FROM system_audit_events WHERE action LIKE 'system.attachment.preservation.%'",
        )
        .first<Record<string, unknown>>(),
    ).toEqual({ count: 0 })
  } finally {
    write.mockRestore()
  }
})

test("保全一覧はcursorと上限を検査し、別添付の解除を拒否する", async () => {
  const c = await fixture()
  const command = c.command()
  expect((await c.create(command)).status).toBe(201)
  expect((await c.create(c.command())).status).toBe(201)
  const first = attachmentPreservationListResponseSchema.parse(
    await (
      await c.request(`${c.endpoint}?limit=1`, { method: "GET", headers: await c.headers() })
    ).json(),
  )
  expect(first.preservations).toHaveLength(1)
  const second = attachmentPreservationListResponseSchema.parse(
    await (
      await c.request(`${c.endpoint}?limit=1&cursor=${z.uuid().parse(first.next_cursor)}`, {
        method: "GET",
        headers: await c.headers(),
      })
    ).json(),
  )
  expect(second.preservations).toHaveLength(1)
  expect(second.preservations[0]?.id).not.toBe(first.preservations[0]?.id)
  expect(second.next_cursor).toBeNull()
  expect(
    (await c.request(`${c.endpoint}?limit=101`, { method: "GET", headers: await c.headers() }))
      .status,
  ).toBe(400)
  expect(
    (
      await c.request(`/system/attachments/other/preservations/${command.id}/release`, {
        method: "POST",
        headers: await c.headers(),
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          expectedRevision: 1,
          reason: "wrong attachment",
        }),
      })
    ).status,
  ).toBe(404)
})

test("登録と解除の同時再送は一つの保全と一つずつの監査に収束する", async () => {
  const c = await fixture()
  const command = c.command()
  const headers = await c.headers()
  const create = () =>
    c.request(c.endpoint, { method: "POST", headers, body: JSON.stringify(command) })
  const created = await Promise.all([create(), create()])
  expect(created.map((response) => response.status).sort((a, b) => a - b)).toEqual([200, 201])
  const releasedBody = JSON.stringify({
    operationId: crypto.randomUUID(),
    expectedRevision: 1,
    reason: "Review completed",
  })
  const release = () =>
    c.request(`${c.endpoint}/${command.id}/release`, {
      method: "POST",
      headers,
      body: releasedBody,
    })
  const responses = await Promise.all([release(), release()])
  expect(responses.map((response) => response.status)).toEqual([200, 200])
  const replies = await Promise.all(
    responses.map(
      async (response) =>
        attachmentPreservationResponseSchema.parse(await response.json()).replayed,
    ),
  )
  expect(replies.sort((a, b) => Number(a) - Number(b))).toEqual([false, true])
  expect(
    await c.db
      .prepare(
        "SELECT count(*) AS count FROM system_audit_events WHERE action LIKE 'system.attachment.preservation.%'",
      )
      .first<Record<string, unknown>>(),
  ).toEqual({ count: 2 })
})

test("保持期限と削除停止が重なる場合は両方を満たすまで削除しない", async () => {
  const c = await fixture()
  const hold = c.command()
  expect((await c.create(hold)).status).toBe(201)
  expect((await c.create(c.command("retention"))).status).toBe(201)
  expect(
    (
      await c.create({
        ...c.command("retention"),
        retainUntil: new Date(at.getTime() + 2000).toISOString(),
      })
    ).status,
  ).toBe(201)
  expect((await c.release(hold.id)).status).toBe(200)
  c.clock.now = new Date(at.getTime() + 1000)
  expect(await responseJson(await c.purge())).toEqual({ purged_count: 0 })
  c.clock.now = new Date(at.getTime() + 2000)
  expect(await responseJson(await c.purge())).toEqual({ purged_count: 1 })
})

test("登録済み操作の再送でも失効した権限を受け入れない", async () => {
  const c = await fixture()
  const command = c.command()
  expect((await c.create(command)).status).toBe(201)
  await c.db
    .prepare("DELETE FROM system_iam_role_permissions WHERE permission_key = 'system:admin'")
    .run()
  expect((await c.create(command)).status).toBe(403)
  expect((await c.request(c.endpoint, { method: "GET", headers: await c.headers() })).status).toBe(
    403,
  )
})

test("解除直前に再認証が失効したら削除停止を残す", async () => {
  const c = await fixture()
  const command = c.command()
  expect((await c.create(command)).status).toBe(201)
  // oxlint-disable-next-line typescript/unbound-method -- 呼出し元のthisを保ち、保存直前へ失効を挿入する。
  const original = AttachmentPreservationRepository.prototype.write
  const write = spyOn(AttachmentPreservationRepository.prototype, "write").mockImplementation(
    async function (this: AttachmentPreservationRepository, entity, audit) {
      await c.db
        .prepare("UPDATE system_step_up_grants SET revoked_at = ?1 WHERE revoked_at IS NULL")
        .bind(at.getTime())
        .run()
      return original.call(this, entity, audit)
    },
  )
  try {
    expect((await c.release(command.id)).status).toBe(403)
    expect(
      await c.db
        .prepare("SELECT revision, released_at FROM system_attachment_preservations")
        .first<Record<string, unknown>>(),
    ).toEqual({ revision: 1, released_at: null })
    expect(
      await c.db
        .prepare(
          "SELECT count(*) AS count FROM system_audit_events WHERE action = 'system.attachment.preservation.released'",
        )
        .first<Record<string, unknown>>(),
    ).toEqual({ count: 0 })
  } finally {
    write.mockRestore()
  }
})

test("保全と監査を外側の保存と一緒に確定し、後続失敗ではすべて取り消す", async () => {
  const f = await fixture()
  const entity = AttachmentPreservationEntity.create({
    ...f.command(),
    attachmentId: f.attachment.id,
    actorAccountId: "282b84eb-787d-4655-a88b-c072960fc970",
    createdAt: at.toISOString(),
    auditEventId: crypto.randomUUID(),
    revision: 1,
    release: null,
  })
  if (entity instanceof Error) throw entity
  const audit = entity.audit(null)
  if (audit instanceof Error) throw audit
  const repository = new AttachmentPreservationRepository({ env: { DB: f.db }, assertions: [] })
  const failure = await f.db
    .batch([
      ...repository.prepareWrite(entity, audit),
      f.db.prepare("SELECT json_extract('{}', 'reject_outer_record')"),
    ])
    .then(
      () => null,
      (cause: unknown) => cause,
    )
  expect(failure).toBeInstanceOf(Error)
  expect(await repository.find(entity.snapshot.id)).toBeNull()
  expect(
    await f.db
      .prepare(
        "SELECT count(*) AS count FROM system_audit_events WHERE action LIKE 'system.attachment.preservation.%'",
      )
      .first<{ count: number }>(),
  ).toEqual({ count: 0 })
  await f.db.batch(repository.prepareWrite(entity, audit).slice())
  const saved = await repository.find(entity.snapshot.id)
  if (saved === null || saved instanceof Error) throw new Error("preservation missing after retry")
  expect(saved.snapshot.id).toBe(entity.snapshot.id)
  expect(
    await f.db
      .prepare(
        "SELECT count(*) AS count FROM system_audit_events WHERE action LIKE 'system.attachment.preservation.%'",
      )
      .first<{ count: number }>(),
  ).toEqual({ count: 1 })
})
