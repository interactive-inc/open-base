import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { StoreAttachment } from "@system/application/attachments/store-attachment"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/system.attachments.purge-unlinked"
import { systemAttachmentSchema } from "@system/infrastructure/schema/system-attachment"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { PrepareAttachmentEvidenceAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-evidence.adapter"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

class PurgeTestBucket extends SystemAttachmentTestBucket {
  beforeDelete: (() => Promise<void>) | undefined
  failDelete = false

  override async delete(key: string): Promise<void> {
    await this.beforeDelete?.()
    if (this.failDelete) throw new Error("test storage deletion failure")
    await super.delete(key)
  }
}

const jwtSecret = "attachments-purge-route-test-secret"

const uploadedAt = new Date("2026-08-19T09:00:00.000Z")

/** アップロードから 24 時間以上あとの実行時刻。 */
const purgeAt = new Date("2026-08-21T09:00:00.000Z")

type Fixture = Readonly<{
  request: (path: string, init?: RequestInit) => Promise<Response>
  bucket: PurgeTestBucket
  db: D1Database
  attachments: AttachmentAdapter
  tokenOf: (accountId: string) => Promise<string>
  storePending: () => Promise<string>
}>

async function createFixture(options: { storageConfigured?: boolean } = {}): Promise<Fixture> {
  const db = await createSystemAttachmentTestDatabase()

  for (const accountId of [
    "3bca86aa-5332-4a10-bacb-a2b82d961613",
    "054361de-dcc9-4d31-9703-2a1237a8b6dd",
  ]) {
    await db
      .prepare(
        `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`,
      )
      .bind(accountId, uploadedAt.getTime())
      .run()
  }

  await db
    .prepare(
      `INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
       VALUES ('be72ba18-7abe-47f1-8371-b41cff620297', 'system:root', 'managed', 'System root', ?1, ?1)`,
    )
    .bind(uploadedAt.getTime())
    .run()

  await db
    .prepare(
      `INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('be72ba18-7abe-47f1-8371-b41cff620297', 'system:admin')`,
    )
    .run()

  await db
    .prepare(
      `INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
       VALUES ('09ef108e-50f8-4909-8969-532bd57c6cc9', '3bca86aa-5332-4a10-bacb-a2b82d961613', 'be72ba18-7abe-47f1-8371-b41cff620297', NULL, NULL, ?1, NULL)`,
    )
    .bind(uploadedAt.getTime())
    .run()

  const bucket = new PurgeTestBucket()

  const database = drizzle(db, { schema: { ...systemCoreSchema, ...systemAttachmentSchema } })

  const app = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => purgeAt)
      context.set("database", database)
      await next()
    })
    .post("/system/attachments/purge-unlinked", ...POST)

  const applications = createSystemSessionApplications({
    context: { env: { DB: db } },
    jwtSecret,
    sessionTtlMilliseconds: 604_800_000,
  })

  if (applications instanceof Error) throw applications

  return {
    bucket,
    db,
    attachments: new AttachmentAdapter({ var: { database } }),
    request: async (path, init) =>
      app.request(path, init, {
        DB: db,
        JWT_SECRET: jwtSecret,
        ATTACHMENTS:
          options.storageConfigured === false ? undefined : (bucket as unknown as R2Bucket),
        ATTACHMENT_KEKS: createSystemAttachmentTestKekEnvironment(1),
      }),
    tokenOf: async (accountId) => {
      const issuance = await applications.issue.execute({
        accountId: zAccountId.parse(accountId),
        tokenVersion: 0,
        now: new Date(),
        auditContext: { authorizationJson: null, metadataJson: null },
      })

      if (issuance instanceof Error || issuance.kind === "rejected") {
        throw new Error("テスト用トークンを発行できません")
      }

      return issuance.accessToken
    },
    storePending: async () => {
      const stored = await new StoreAttachment({
        var: { database },
        env: {
          ATTACHMENTS: bucket as unknown as R2Bucket,
          ATTACHMENT_KEKS: createSystemAttachmentTestKekEnvironment(1),
        },
      }).run({
        ownerAccountId: "054361de-dcc9-4d31-9703-2a1237a8b6dd",
        fileName: "領収書.pdf",
        contentType: "application/pdf",
        content: new TextEncoder().encode("%PDF-1.7 領収書"),
        now: uploadedAt,
      })

      if (stored instanceof Error) throw stored
      return stored.id
    },
  }
}

/**
 * ルートハンドラが素の Response を返す経路では Hono が JSON schema を推論できず、
 * `response.json()` の戻り値が undefined 型になる。実際の body は実行時に組み立てられる。
 * handle-api-error.test.ts と同じ形で unknown として読み、比較は toEqual に委ねる。
 */
async function responseJson(response: Response): Promise<unknown> {
  return response.json()
}

describe("POST /system/attachments/purge-unlinked", () => {
  test("削除開始後に確定する証拠の紐付けを業務保存ごと拒否する", async () => {
    const fixture = await createFixture()
    const id = await fixture.storePending()
    await fixture.db.prepare("CREATE TABLE test_business_records (id TEXT PRIMARY KEY)").run()
    const prepared = await new PrepareAttachmentEvidenceAdapter({
      env: { DB: fixture.db },
    }).prepare({
      attachmentIds: [id],
      ownerAccountId: "054361de-dcc9-4d31-9703-2a1237a8b6dd",
      linkedAttachmentIds: new Set(),
      at: purgeAt,
    })
    if (prepared instanceof Error) throw prepared
    let result: unknown
    fixture.bucket.beforeDelete = async () => {
      result = await fixture.db
        .batch([
          fixture.db.prepare("INSERT INTO test_business_records VALUES ('business')"),
          ...prepared.guards,
          ...prepared.effects,
        ])
        .catch((cause: unknown) => cause)
    }
    const response = await fixture.request("/system/attachments/purge-unlinked", {
      method: "POST",
      headers: {
        authorization: `Bearer ${await fixture.tokenOf("3bca86aa-5332-4a10-bacb-a2b82d961613")}`,
      },
    })
    expect(response.status).toBe(200)
    expect(result).toBeInstanceOf(Error)
    expect(await fixture.db.prepare("SELECT * FROM test_business_records").first()).toBeNull()
    expect(await fixture.attachments.findById(id)).toBeNull()
    expect(fixture.bucket.size()).toBe(0)
  })

  test("候補走査後に紐付いた添付の本体は削除しない", async () => {
    const fixture = await createFixture()
    const id = await fixture.storePending()
    const original = fixture.attachments.listStaleUnlinked.bind(fixture.attachments)
    const scan = spyOn(AttachmentAdapter.prototype, "listStaleUnlinked").mockImplementation(
      async (threshold, limit, now) => {
        const rows = await original(threshold, limit, now)
        const linked = await fixture.attachments.markLinked(id, purgeAt)
        if (linked instanceof Error) throw linked
        return rows
      },
    )
    try {
      const response = await fixture.request("/system/attachments/purge-unlinked", {
        method: "POST",
        headers: {
          authorization: `Bearer ${await fixture.tokenOf("3bca86aa-5332-4a10-bacb-a2b82d961613")}`,
        },
      })
      expect(response.status).toBe(200)
      expect(await responseJson(response)).toEqual({ purged_count: 0 })
      expect(await fixture.attachments.findById(id)).toMatchObject({ status: "linked" })
      expect(fixture.bucket.size()).toBe(1)
    } finally {
      scan.mockRestore()
    }
  })

  test("system:admin は期限切れの未紐づけ添付を掃除できる", async () => {
    const fixture = await createFixture()

    await fixture.storePending()

    expect(fixture.bucket.size()).toBe(1)

    const token = await fixture.tokenOf("3bca86aa-5332-4a10-bacb-a2b82d961613")

    const response = await fixture.request("/system/attachments/purge-unlinked", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    expect(await responseJson(response)).toEqual({ purged_count: 1 })
    expect(fixture.bucket.size()).toBe(0)
  })

  test("本体削除の失敗後は紐付けを拒否し、次回の掃除で回収する", async () => {
    const fixture = await createFixture()
    const id = await fixture.storePending()
    const headers = {
      authorization: `Bearer ${await fixture.tokenOf("3bca86aa-5332-4a10-bacb-a2b82d961613")}`,
    }
    fixture.bucket.failDelete = true
    const failed = await fixture.request("/system/attachments/purge-unlinked", {
      method: "POST",
      headers,
    })
    expect(failed.status).toBe(503)
    expect(await fixture.attachments.findById(id)).toMatchObject({
      status: "erased",
      wrappedDek: null,
      wrappedDekIv: null,
      linkedAt: null,
    })
    expect(await fixture.attachments.markLinked(id, purgeAt)).toBeInstanceOf(Error)
    expect(fixture.bucket.size()).toBe(1)
    fixture.bucket.failDelete = false
    const retried = await fixture.request("/system/attachments/purge-unlinked", {
      method: "POST",
      headers,
    })
    expect(retried.status).toBe(200)
    expect(await responseJson(retried)).toEqual({ purged_count: 1 })
    expect(await fixture.attachments.findById(id)).toBeNull()
    expect(fixture.bucket.size()).toBe(0)
  })

  test("DB行削除の失敗後も本体の削除と完了を再試行できる", async () => {
    const fixture = await createFixture()
    const id = await fixture.storePending()
    const headers = {
      authorization: `Bearer ${await fixture.tokenOf("3bca86aa-5332-4a10-bacb-a2b82d961613")}`,
    }
    await fixture.db
      .prepare(`CREATE TRIGGER test_block_attachment_removal BEFORE DELETE ON system_attachments
      BEGIN SELECT RAISE(ABORT, 'test removal failure'); END`)
      .run()
    const failed = await fixture.request("/system/attachments/purge-unlinked", {
      method: "POST",
      headers,
    })
    expect(failed.status).toBe(503)
    expect(await fixture.attachments.findById(id)).toMatchObject({ status: "erased" })
    expect(fixture.bucket.size()).toBe(0)
    await fixture.db.prepare("DROP TRIGGER test_block_attachment_removal").run()
    const retried = await fixture.request("/system/attachments/purge-unlinked", {
      method: "POST",
      headers,
    })
    expect(retried.status).toBe(200)
    expect(await responseJson(retried)).toEqual({ purged_count: 1 })
    expect(await fixture.attachments.findById(id)).toBeNull()
  })

  test("期限ちょうどと紐付け済みは残し、期限前の予約行だけを回収する", async () => {
    const fixture = await createFixture()
    const boundary = await fixture.storePending()
    const linked = await fixture.storePending()
    const uploading = await fixture.storePending()
    await fixture.db
      .prepare("UPDATE system_attachments SET created_at = ?2 WHERE id = ?1")
      .bind(boundary, purgeAt.getTime() - 24 * 60 * 60 * 1000)
      .run()
    const result = await fixture.attachments.markLinked(linked, purgeAt)
    if (result instanceof Error) throw result
    await fixture.db
      .prepare("UPDATE system_attachments SET status = 'uploading' WHERE id = ?1")
      .bind(uploading)
      .run()
    const response = await fixture.request("/system/attachments/purge-unlinked", {
      method: "POST",
      headers: {
        authorization: `Bearer ${await fixture.tokenOf("3bca86aa-5332-4a10-bacb-a2b82d961613")}`,
      },
    })
    expect(response.status).toBe(200)
    expect(await responseJson(response)).toEqual({ purged_count: 1 })
    expect(await fixture.attachments.findById(boundary)).toMatchObject({ status: "pending" })
    expect(await fixture.attachments.findById(linked)).toMatchObject({ status: "linked" })
    expect(await fixture.attachments.findById(uploading)).toBeNull()
    expect(fixture.bucket.size()).toBe(2)
  })

  test("二つの掃除が同じ本体を選んでも回収数を二重に数えない", async () => {
    const fixture = await createFixture()
    const id = await fixture.storePending()
    const headers = {
      authorization: `Bearer ${await fixture.tokenOf("3bca86aa-5332-4a10-bacb-a2b82d961613")}`,
    }
    let waiting = 0
    let release: () => void = () => {}
    const bothDeleting = new Promise<void>((resolve) => {
      release = resolve
    })
    fixture.bucket.beforeDelete = async () => {
      waiting += 1
      if (waiting === 2) release()
      await bothDeleting
    }
    const responses = await Promise.all([
      fixture.request("/system/attachments/purge-unlinked", { method: "POST", headers }),
      fixture.request("/system/attachments/purge-unlinked", { method: "POST", headers }),
    ])
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    const bodies = await Promise.all(responses.map(responseJson))
    expect(bodies).toContainEqual({ purged_count: 1 })
    expect(bodies).toContainEqual({ purged_count: 0 })
    expect(waiting).toBe(2)
    expect(await fixture.attachments.findById(id)).toBeNull()
    expect(fixture.bucket.size()).toBe(0)
  })

  test("保管先が未設定なら鍵を破棄しない", async () => {
    const fixture = await createFixture({ storageConfigured: false })
    const id = await fixture.storePending()
    const response = await fixture.request("/system/attachments/purge-unlinked", {
      method: "POST",
      headers: {
        authorization: `Bearer ${await fixture.tokenOf("3bca86aa-5332-4a10-bacb-a2b82d961613")}`,
      },
    })
    expect(response.status).toBe(503)
    const row = await fixture.attachments.findById(id)
    if (row instanceof Error || row === null) throw new Error("attachment row missing")
    expect(row.status).toBe("pending")
    expect(row.wrappedDek).not.toBeNull()
    expect(fixture.bucket.size()).toBe(1)
  })

  test("権限のない主体は実行できず、本体も消えない", async () => {
    const fixture = await createFixture()

    await fixture.storePending()

    const token = await fixture.tokenOf("054361de-dcc9-4d31-9703-2a1237a8b6dd")

    const response = await fixture.request("/system/attachments/purge-unlinked", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(403)
    expect(fixture.bucket.size()).toBe(1)
  })

  test("未認証は実行できない", async () => {
    const fixture = await createFixture()

    await fixture.storePending()

    const response = await fixture.request("/system/attachments/purge-unlinked", {
      method: "POST",
    })

    expect(response.status).toBe(401)
    expect(fixture.bucket.size()).toBe(1)
  })
})
