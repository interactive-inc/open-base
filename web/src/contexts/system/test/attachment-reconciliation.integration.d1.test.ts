import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { ATTACHMENT_RECONCILIATION_LEASE_MILLISECONDS } from "@system/domain/catalogs/attachments/attachment-reconciliation.catalog"
import { reconcileSystemAttachmentObjects } from "@system/interface/operations/reconcile-system-attachment-objects"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"
import { testAccountId, testDerivedId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const viewer = testAccountId("reconcile_viewer")
const root = testAccountId("reconcile_root")
const member = testAccountId("reconcile_member")

function attachmentId(index: number): string {
  return `01900060-0000-7000-8000-${String(index).padStart(12, "0")}`
}

async function createFixture(count: number) {
  const db = await createSystemAttachmentTestDatabase()
  const bucket = new SystemAttachmentTestBucket()
  let now = new Date("2026-09-01T00:00:00.000Z")
  const statements = [viewer, root, member].map((id) =>
    db
      .prepare(
        "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES (?1, 'active', 0, 0, 0)",
      )
      .bind(id),
  )
  for (const [account, permission] of [
    [viewer, "batch:view"],
    [root, "system:admin"],
    [member, "audit:read"],
  ] as const) {
    const roleId = testDerivedId("reconcile_role", permission)
    statements.push(
      db
        .prepare(
          "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES (?1, ?2, 'custom', 'Role', 0, 0)",
        )
        .bind(roleId, `test:${permission.replace(":", "-")}`),
      db
        .prepare(
          "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, ?2)",
        )
        .bind(roleId, permission),
      db
        .prepare(
          "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES (?1, ?2, ?3, 0)",
        )
        .bind(testDerivedId("reconcile_binding", permission), account, roleId),
    )
  }
  for (let index = 1; index <= count; index++) {
    const id = attachmentId(index)
    statements.push(
      db
        .prepare(
          `INSERT INTO system_attachments
           (id, owner_account_id, object_key, status, content_type, byte_size, file_name,
            plaintext_sha256, wrapped_dek, wrapped_dek_iv, content_iv, kek_version, created_at, linked_at)
           VALUES (?1, ?2, ?3, 'linked', 'application/pdf', 1, 'file.pdf', ?4, 'w', 'wi', 'ci', 1, 0, 0)`,
        )
        .bind(id, member, `att/${id}`, "a".repeat(64)),
    )
    await bucket.put(`att/${id}`, new Uint8Array([index]))
  }
  await db.batch(statements)

  const run = (
    limits = { chunkSize: 2, maxChunks: 1 },
    storage: SystemAttachmentTestBucket | R2Bucket = bucket,
  ) =>
    reconcileSystemAttachmentObjects(
      {
        env: { DB: db, ATTACHMENTS: storage as unknown as R2Bucket },
        clock: () => now,
      },
      limits,
    )
  const advance = (milliseconds: number) => {
    now = new Date(now.getTime() + milliseconds)
  }
  const jobs = async () =>
    (
      await db
        .prepare(
          "SELECT status, message FROM system_batch_jobs WHERE name = 'system.attachment.reconciliation' ORDER BY rowid",
        )
        .all<{ status: string; message: string | null }>()
    ).results.map((row) => ({
      status: row.status,
      message: row.message === null ? null : JSON.parse(row.message),
    }))
  const deliveries = async () =>
    (
      await db
        .prepare(
          `SELECT delivery.recipient_account_id AS recipient, message.title, message.body, message.kind
           FROM system_notification_deliveries delivery
           INNER JOIN system_notification_messages message ON message.id = delivery.message_id
           ORDER BY message.created_at, delivery.recipient_account_id`,
        )
        .all<{ recipient: string; title: string; body: string; kind: string }>()
    ).results
  return { db, bucket, run, advance, jobs, deliveries }
}

describe("System attachment reconciliation", () => {
  test("添付行をid順にchunkで辿り、位置をbatch jobへ記録して次の実行が続きから確認する", async () => {
    const f = await createFixture(5)

    expect(await f.run()).toMatchObject({
      status: "completed",
      checked: 2,
      missingAttachmentIds: [],
      nextCursor: attachmentId(2),
    })
    f.advance(1_000)
    expect(await f.run({ chunkSize: 2, maxChunks: 5 })).toMatchObject({
      status: "completed",
      checked: 3,
      nextCursor: null,
    })
    f.advance(1_000)
    // 一巡したら先頭から確認し直す。
    expect(await f.run()).toMatchObject({ checked: 2, nextCursor: attachmentId(2) })
    expect((await f.jobs()).map((job) => [job.status, job.message.nextCursor])).toEqual([
      ["completed", attachmentId(2)],
      ["completed", null],
      ["completed", attachmentId(2)],
    ])
    expect(await f.deliveries()).toEqual([])
  })

  test("本体の欠損と規約外のkeyを記録し、batch:viewとsystem:adminを持つAccountだけへ通知する", async () => {
    const f = await createFixture(3)
    await f.bucket.delete(`att/${attachmentId(2)}`)
    await f.db
      .prepare("UPDATE system_attachments SET object_key = 'att/other-key' WHERE id = ?1")
      .bind(attachmentId(3))
      .run()

    expect(await f.run({ chunkSize: 10, maxChunks: 1 })).toMatchObject({
      status: "completed",
      missingAttachmentIds: [attachmentId(2), attachmentId(3)],
      notifiedAccounts: 2,
    })
    expect((await f.jobs())[0]?.message).toMatchObject({
      missingCount: 2,
      missingAttachmentIds: [attachmentId(2), attachmentId(3)],
      notifiedAccounts: 2,
      failure: null,
    })
    const delivered = await f.deliveries()
    expect(delivered.map((row) => row.recipient)).toEqual([root, viewer].sort())
    expect(delivered[0]).toMatchObject({
      kind: "system:attachment.reconciliation",
      title: "添付本体の欠損を検出しました",
    })
    expect(delivered[0]?.body).toContain(attachmentId(2))
  })

  test("存在確認に失敗したchunkでは位置を進めず、失敗へ変わった時だけ通知する", async () => {
    const f = await createFixture(4)
    await f.run()
    const failing = {
      head: async () => {
        throw new Error("storage unavailable")
      },
    } as unknown as R2Bucket

    f.advance(1_000)
    expect(await f.run(undefined, failing)).toMatchObject({
      status: "failed",
      checked: 0,
      nextCursor: attachmentId(2),
      notifiedAccounts: 2,
    })
    f.advance(1_000)
    expect(await f.run(undefined, failing)).toMatchObject({ status: "failed", notifiedAccounts: 0 })
    f.advance(1_000)
    // 失敗した実行の位置から再開する。
    expect(await f.run()).toMatchObject({
      status: "completed",
      checked: 2,
      nextCursor: attachmentId(4),
    })
    expect((await f.deliveries()).map((row) => row.title)).toEqual([
      "添付本体の照合が失敗しました",
      "添付本体の照合が失敗しました",
    ])
  })

  test("実行中の記録があれば始めず、期限を過ぎた実行は失敗として閉じてから始める", async () => {
    const f = await createFixture(1)
    await f.db
      .prepare(
        "INSERT INTO system_batch_jobs (id, name, status, started_at) VALUES (?1, 'system.attachment.reconciliation', 'running', ?2)",
      )
      .bind("0f6c8d8e-1a8b-4c3a-9a55-7a1f6f3b2c10", new Date("2026-09-01T00:00:00.000Z").getTime())
      .run()

    expect(await f.run()).toEqual({ status: "busy" })
    f.advance(ATTACHMENT_RECONCILIATION_LEASE_MILLISECONDS)
    expect(await f.run()).toMatchObject({ status: "completed", checked: 1 })
    expect((await f.jobs()).map((job) => [job.status, job.message?.failure ?? null])).toEqual([
      ["failed", "lease_expired"],
      ["completed", null],
    ])
  })

  test("保存先が無い配備と不正な上限では実行を記録しない", async () => {
    const f = await createFixture(1)

    expect(
      await reconcileSystemAttachmentObjects(
        { env: { DB: f.db }, clock: () => new Date() },
        { chunkSize: 2, maxChunks: 1 },
      ),
    ).toBeInstanceOf(Error)
    expect(await f.run({ chunkSize: 0, maxChunks: 1 })).toBeInstanceOf(Error)
    expect(await f.jobs()).toEqual([])
  })
})
