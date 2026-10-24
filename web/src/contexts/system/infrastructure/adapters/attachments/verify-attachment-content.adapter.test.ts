import { z } from "zod"
import { expect, test } from "bun:test"
import { VerifyAttachmentContentAdapter } from "@system/infrastructure/adapters/attachments/verify-attachment-content.adapter"
import { encryptAttachment } from "@system/application/attachments/lib/encrypt-attachment"
import { AttachmentKekRegistry } from "@system/application/attachments/lib/attachment-kek-registry"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import type { SystemAttachmentRow } from "@system/infrastructure/schema/system-attachment"

test("一般添付の実バイトを検証し、欠落・改変・サイズ不一致・鍵の欠損を拒否する", async () => {
  const keys = createSystemAttachmentTestKekEnvironment()
  const registry = AttachmentKekRegistry.fromEnv(keys)
  if (registry instanceof Error) throw registry
  const original = new Uint8Array([0, 1, 127, 128, 254, 255])
  const encrypted = await encryptAttachment(original, registry.current())
  const bucket = new SystemAttachmentTestBucket()
  const row: SystemAttachmentRow = {
    id: crypto.randomUUID(),
    ownerAccountId: "account:owner",
    objectKey: "att/example",
    status: "linked",
    contentType: "application/pdf",
    byteSize: original.byteLength,
    fileName: "original.pdf",
    plaintextSha256: encrypted.plaintextSha256,
    wrappedDek: encrypted.wrappedDek,
    wrappedDekIv: encrypted.wrappedDekIv,
    contentIv: encrypted.contentIv,
    kekVersion: encrypted.kekVersion,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    linkedAt: new Date("2026-09-01T00:00:00Z"),
    erasedAt: null,
  }
  const verify = (attachment: SystemAttachmentRow) => {
    const app = systemFactory.createApp().get("/verify", async (c) => {
      const content = await new VerifyAttachmentContentAdapter(c).execute(attachment, "linked")
      if (content instanceof Error) return c.json({ error: "unavailable" }, 409)
      return c.json({ bytes: [...content] })
    })
    return app.request("/verify", {}, { ATTACHMENTS: bucket, ATTACHMENT_KEKS: keys })
  }
  expect((await verify(row)).status).toBe(409)
  await bucket.put(row.objectKey, encrypted.ciphertext)
  const valid = await verify(row)
  expect(valid.status).toBe(200)
  expect(z.strictObject({ bytes: z.array(z.number()) }).parse(await valid.json())).toEqual({
    bytes: [...original],
  })
  for (const changed of [
    { ...row, byteSize: row.byteSize + 1 },
    { ...row, plaintextSha256: "0".repeat(64) },
    { ...row, wrappedDek: null },
    { ...row, erasedAt: new Date() },
    { ...row, kekVersion: 2 },
  ]) {
    expect((await verify(changed)).status).toBe(409)
  }
  expect((await verify({ ...row, status: "pending" })).status).toBe(409)
  await bucket.put(row.objectKey, new Uint8Array(encrypted.ciphertext.byteLength))
  expect((await verify(row)).status).toBe(409)
})
