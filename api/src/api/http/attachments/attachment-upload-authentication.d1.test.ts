import { afterAll, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { Miniflare } from "miniflare"
import { createAppBase } from "@/api/app-base"
import { POST } from "@system/interface/routes/system.attachments"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { AttachmentObjectAdapter } from "@system/infrastructure/adapters/attachments/attachment-object.adapter"

setDefaultTimeout(30_000)
const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response(null) } }",
  compatibilityDate: "2026-05-24",
  r2Buckets: ["ATTACHMENTS"],
})
const fixture = { bucket: await runtime.getR2Bucket("ATTACHMENTS") }
const now = new Date()
const secret = "example-attachment-http-secret"
const app = createAppBase().post("/system/attachments", ...POST)
afterAll(() => runtime.dispose())
function environment() {
  return {
    ATTACHMENTS: fixture.bucket,
    ATTACHMENT_KEKS: createSystemAttachmentTestKekEnvironment(),
    JWT_SECRET: secret,
    NOW: now.toISOString(),
    API_RATE_LIMITER: { limit: async () => ({ success: true }) },
  }
}
async function authenticationRaceFixture(withFamily = false, tokenVersion = 0) {
  const database = await createSystemAttachmentTestDatabase()
  const accountId = zAccountId.parse(crypto.randomUUID())
  await database
    .prepare(
      "INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES (?1,'active',?2,0,0)",
    )
    .bind(accountId, tokenVersion)
    .run()
  const familyId = withFamily ? crypto.randomUUID() : null
  if (familyId !== null)
    await database
      .prepare(
        "INSERT INTO system_sessions(id,account_id,family_id,token_hash,token_version,created_at,expires_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
      )
      .bind(
        crypto.randomUUID(),
        accountId,
        familyId,
        "e".repeat(64),
        tokenVersion,
        now.getTime(),
        now.getTime() + 3600000,
      )
      .run()
  const token = await new SystemAccessTokenIssuer(secret).issue({
    accountId,
    tokenVersion,
    sessionFamilyId: familyId ?? undefined,
    now,
  })
  if (token instanceof Error) throw token
  return { database, token, familyId, bindings: { ...environment(), DB: database } }
}

test("本文読取中に認証版が失効したuploadは保存前に拒否する", async () => {
  const f = await authenticationRaceFixture()
  const beforeObjects = (await fixture.bucket.list()).objects.map((object) => object.key)
  const bytes = new TextEncoder().encode(
    '--example-upload-boundary\r\nContent-Disposition: form-data; name="file"; filename="example.pdf"\r\nContent-Type: application/pdf\r\n\r\nexample-body\r\n--example-upload-boundary--\r\n',
  )
  const effects: boolean[] = []
  const body = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        await f.database.prepare("UPDATE system_accounts SET token_version=1").run()
        effects.push(true)
        controller.enqueue(bytes)
        controller.close()
      },
    },
    { highWaterMark: 0 },
  )
  const headers = new Headers({
    "content-type": "multipart/form-data; boundary=example-upload-boundary",
  })
  headers.set("authorization", `Bearer ${f.token}`)
  const response = await app.request(
    "https://api.example.com/system/attachments",
    { method: "POST", body, headers },
    f.bindings,
  )
  expect(effects).toEqual([true])
  expect(response.status).toBe(401)
  expect(
    await f.database
      .prepare("SELECT count(*) AS count FROM system_attachments")
      .first<number>("count"),
  ).toBe(0)
  expect((await fixture.bucket.list()).objects.map((object) => object.key)).toEqual(beforeObjects)
})

test("R2保存中に認証版が失効したuploadは成功応答を返さない", async () => {
  const f = await authenticationRaceFixture()
  const intercepted = spyOn(AttachmentObjectAdapter.prototype, "put")
  const original = intercepted.getMockImplementation()
  if (original === undefined) throw new Error("missing original attachment writer")
  intercepted.mockImplementation(async function (this: AttachmentObjectAdapter, ...args) {
    const result = await original.call(this, ...args)
    await f.database.prepare("UPDATE system_accounts SET token_version=1").run()
    return result
  })
  try {
    const body = new FormData()
    body.set("file", new File(["example-body"], "example.pdf", { type: "application/pdf" }))
    const response = await app.request(
      "https://api.example.com/system/attachments",
      { method: "POST", body, headers: { authorization: `Bearer ${f.token}` } },
      f.bindings,
    )
    expect(intercepted).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(401)
    const row = await f.database
      .prepare("SELECT status,object_key FROM system_attachments")
      .first<{ status: string; object_key: string }>()
    expect(row?.status).toBe("uploading")
    if (row === null) throw new Error("missing upload reservation")
    expect(await fixture.bucket.head(row.object_key)).not.toBeNull()
  } finally {
    intercepted.mockRestore()
  }
})

async function raceUpload(f: Awaited<ReturnType<typeof authenticationRaceFixture>>) {
  const body = new FormData()
  body.set("file", new File(["example-body"], "example.pdf", { type: "application/pdf" }))
  return app.request(
    "https://api.example.com/system/attachments",
    { method: "POST", body, headers: { authorization: `Bearer ${f.token}` } },
    f.bindings,
  )
}
for (const stage of ["reservation", "pending"]) {
  test(`保存transaction内の認証変化を全取消する: ${stage}`, async () => {
    const f = await authenticationRaceFixture()
    const trigger =
      stage === "reservation"
        ? "AFTER INSERT ON system_attachments"
        : "AFTER UPDATE OF status ON system_attachments WHEN NEW.status='pending'"
    await f.database
      .prepare(
        `CREATE TRIGGER example_upload_actor_change ${trigger} BEGIN UPDATE system_accounts SET token_version=token_version+1; END`,
      )
      .run()
    const response = await raceUpload(f)
    expect(response.status).toBe(401)
    expect(
      await f.database
        .prepare("SELECT token_version FROM system_accounts")
        .first<number>("token_version"),
    ).toBe(0)
    const rows = await f.database
      .prepare("SELECT status,object_key FROM system_attachments")
      .all<{ status: string; object_key: string }>()
    if (stage === "reservation") expect(rows.results).toEqual([])
    else {
      expect(rows.results).toHaveLength(1)
      expect(rows.results[0]?.status).toBe("uploading")
      const key = rows.results[0]?.object_key
      if (key === undefined) throw new Error("missing reservation")
      expect(await fixture.bucket.head(key)).not.toBeNull()
    }
  })
}
test("R2書込中にlogoutしたfamilyのuploadはpendingにしない", async () => {
  const f = await authenticationRaceFixture(true)
  const intercepted = spyOn(AttachmentObjectAdapter.prototype, "put")
  const original = intercepted.getMockImplementation()
  if (original === undefined) throw new Error("missing original attachment writer")
  intercepted.mockImplementation(async function (this: AttachmentObjectAdapter, ...args) {
    const result = await original.call(this, ...args)
    await f.database.prepare("UPDATE system_sessions SET revoked_at=?1").bind(Date.now()).run()
    return result
  })
  try {
    expect((await raceUpload(f)).status).toBe(401)
    expect(intercepted).toHaveBeenCalledTimes(1)
    expect(
      await f.database.prepare("SELECT status FROM system_attachments").first<string>("status"),
    ).toBe("uploading")
  } finally {
    intercepted.mockRestore()
  }
})
test("現在の非zero認証版と有効なfamilyで添付を保管できる", async () => {
  const f = await authenticationRaceFixture(true, 2)
  expect((await raceUpload(f)).status).toBe(201)
  expect(
    await f.database.prepare("SELECT status FROM system_attachments").first<string>("status"),
  ).toBe("pending")
})

test("予約INSERTがIGNOREされた場合にR2本体を作らない", async () => {
  const f = await authenticationRaceFixture()
  const beforeObjects = (await fixture.bucket.list()).objects.map((object) => object.key)
  await f.database
    .prepare(
      "CREATE TRIGGER example_ignore_attachment BEFORE INSERT ON system_attachments BEGIN SELECT RAISE(IGNORE); END",
    )
    .run()
  const response = await raceUpload(f)
  expect(response.status).toBe(500)
  expect(await response.json()).toMatchObject({ code: "attachment_reservation_failed" })
  expect(
    await f.database
      .prepare("SELECT count(*) AS count FROM system_attachments")
      .first<number>("count"),
  ).toBe(0)
  expect((await fixture.bucket.list()).objects.map((object) => object.key)).toEqual(beforeObjects)
})
