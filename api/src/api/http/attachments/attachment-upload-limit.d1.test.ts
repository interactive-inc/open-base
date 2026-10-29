import { afterAll, beforeAll, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { Miniflare } from "miniflare"
import { createAppBase } from "@/api/app-base"
import { ATTACHMENT_MAX_BYTE_SIZE } from "@system/domain/catalogs/attachments/attachment-content.catalog"
import { POST } from "@system/interface/routes/system.attachments"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { AttachmentObjectAdapter } from "@system/infrastructure/adapters/attachments/attachment-object.adapter"
import { SystemAttachmentError } from "@system/domain/errors"

setDefaultTimeout(30_000)
const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response(null) } }",
  compatibilityDate: "2026-05-24",
  r2Buckets: ["ATTACHMENTS"],
})
const fixture = {
  database: await createSystemAttachmentTestDatabase(),
  bucket: await runtime.getR2Bucket("ATTACHMENTS"),
  token: "",
}
const now = new Date()
const secret = "example-attachment-http-secret"
const app = createAppBase().post("/system/attachments", ...POST)
beforeAll(async () => {
  const accountId = zAccountId.parse("3b2b8827-25c9-459b-a05b-6eff821639e0")
  await fixture.database
    .prepare(
      "INSERT INTO system_accounts(id,status,created_at,updated_at) VALUES (?1,'active',0,0)",
    )
    .bind(accountId)
    .run()
  const issued = await new SystemAccessTokenIssuer(secret).issue({
    accountId,
    tokenVersion: 0,
    now,
  })
  if (issued instanceof Error) throw issued
  fixture.token = issued
})
afterAll(() => runtime.dispose())

async function upload(size: number, withContentLength = false) {
  const form = new FormData()
  form.set("file", new File([new Uint8Array(size)], "example.pdf", { type: "application/pdf" }))
  const request = new Request("https://api.example.com/system/attachments", {
    method: "POST",
    body: form,
    headers: { authorization: `Bearer ${fixture.token}` },
  })
  if (withContentLength) {
    const bytes = await request.arrayBuffer()
    const headers = new Headers(request.headers)
    headers.set("content-length", String(bytes.byteLength))
    return app.request(
      new Request(request, { method: "POST", body: bytes, headers }),
      undefined,
      environment(),
    )
  }
  return app.request(request, undefined, environment())
}
function environment() {
  return {
    DB: fixture.database,
    ATTACHMENTS: fixture.bucket,
    ATTACHMENT_KEKS: createSystemAttachmentTestKekEnvironment(),
    JWT_SECRET: secret,
    NOW: now.toISOString(),
    API_RATE_LIMITER: { limit: async () => ({ success: true }) },
  }
}
for (const withContentLength of [false, true]) {
  test(`API共通middlewareを通して1MBより大きい添付を保管できる: length=${withContentLength}`, async () => {
    const response = await upload(1_100_000, withContentLength)
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ byte_size: 1_100_000, status: "pending" })
  })
}
test("25MiB本体とmultipart headerを上限内で保管できる", async () => {
  const response = await upload(ATTACHMENT_MAX_BYTE_SIZE)
  expect(response.status).toBe(201)
  expect(await response.json()).toMatchObject({
    byte_size: ATTACHMENT_MAX_BYTE_SIZE,
    status: "pending",
  })
})
test("本体の25MiB超過は従来のSystem413で保管しない", async () => {
  const before = await fixture.database
    .prepare("SELECT count(*) AS count FROM system_attachments")
    .first<number>("count")
  const response = await upload(ATTACHMENT_MAX_BYTE_SIZE + 1)
  expect(response.status).toBe(413)
  expect(await response.json()).toMatchObject({ code: "attachment_byte_size_exceeded" })
  expect(
    await fixture.database
      .prepare("SELECT count(*) AS count FROM system_attachments")
      .first<number>("count"),
  ).toBe(before)
})
for (const withContentLength of [false, true]) {
  test(`multipart総量を超える要求は認証後にSystem413で拒否する: length=${withContentLength}`, async () => {
    const response = await upload(ATTACHMENT_MAX_BYTE_SIZE + 64 * 1024 + 1, withContentLength)
    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ code: "attachment_byte_size_exceeded" })
  })
}
test("未認証の添付bodyは読み込まない", async () => {
  const body = new Request("https://api.example.com/system/attachments", {
    method: "POST",
    body: new Uint8Array(1_100_000),
  })
  const response = await app.request(body, undefined, environment())
  expect(response.status).toBe(401)
  expect(body.bodyUsed).toBe(false)
})
for (const endpoint of [
  { method: "POST", path: "/system/other" },
  { method: "PUT", path: "/system/attachments" },
  { method: "POST", path: "/system/attachments/extra" },
]) {
  test(`一般APIの1MB制限を維持する: ${endpoint.method} ${endpoint.path}`, async () => {
    const response = await app.request(
      "https://api.example.com" + endpoint.path,
      {
        method: endpoint.method,
        body: new Uint8Array(1_100_000),
      },
      environment(),
    )
    expect(response.status).toBe(413)
  })
}

for (const malformed of [
  { contentType: "multipart/form-data", body: "example-invalid-body" },
  { contentType: "multipart/form-data; boundary=example", body: "--other\r\ninvalid\r\n" },
]) {
  test(`不正multipartは内部エラーにせず400で拒否する: ${malformed.contentType}`, async () => {
    const response = await app.request(
      "https://api.example.com/system/attachments",
      {
        method: "POST",
        body: malformed.body,
        headers: {
          authorization: `Bearer ${fixture.token}`,
          "content-type": malformed.contentType,
        },
      },
      environment(),
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toMatchObject({ code: "attachment_body_invalid" })
    expect(JSON.stringify(body)).not.toContain(malformed.body)
  })
}

test("添付bodyの読取失敗は内部エラーにせず400で拒否する", async () => {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(new Error("example-private-body-failure"))
    },
  })
  const response = await app.request(
    "https://api.example.com/system/attachments",
    {
      method: "POST",
      body,
      headers: {
        authorization: `Bearer ${fixture.token}`,
        "content-type": "multipart/form-data; boundary=example",
      },
    },
    environment(),
  )
  expect(response.status).toBe(400)
  const rejected = await response.json()
  expect(rejected).toMatchObject({ code: "attachment_body_invalid" })
  expect(JSON.stringify(rejected)).not.toContain("example-private-body-failure")
})

test("Content-Length経路の本文読取失敗も400で拒否する", async () => {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(new Error("example-private-body-failure"))
    },
  })
  const response = await app.request(
    "https://api.example.com/system/attachments",
    {
      method: "POST",
      body,
      headers: {
        authorization: `Bearer ${fixture.token}`,
        "content-type": "multipart/form-data; boundary=example",
        "content-length": "100",
      },
    },
    environment(),
  )
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({ code: "attachment_body_invalid" })
})

test("保管設定の不足は入力エラーへ変換せず503を維持する", async () => {
  const body = new FormData()
  body.set("file", new File(["example-content"], "example.pdf", { type: "application/pdf" }))
  const response = await app.request(
    "https://api.example.com/system/attachments",
    {
      method: "POST",
      body,
      headers: { authorization: `Bearer ${fixture.token}` },
    },
    { ...environment(), ATTACHMENTS: undefined },
  )
  expect(response.status).toBe(503)
  expect(await response.json()).toMatchObject({ code: "attachment_storage_unconfigured" })
})

test("保管処理の障害は入力エラーへ変換せず500を維持する", async () => {
  const unavailable = spyOn(AttachmentObjectAdapter.prototype, "put").mockResolvedValue(
    new SystemAttachmentError("unexpected", "attachment_store_failed", "example-storage-failure"),
  )
  try {
    const response = await upload(100)
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ code: "attachment_store_failed" })
    expect(unavailable).toHaveBeenCalledTimes(1)
  } finally {
    unavailable.mockRestore()
  }
})
