import { expect, test } from "bun:test"
import { AttachmentRecordContentValue } from "@system/domain/values/records/attachment-record-content.value"
import { ATTACHMENT_MAX_BYTE_SIZE } from "@system/domain/catalogs/attachments/attachment-content.catalog"

test("元添付のメタデータとバイト列を不変にし、破損・余分な情報・添付上限超過を拒否する", async () => {
  const bytes = new TextEncoder().encode("abc")
  const metadata = {
    id: "original",
    sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    fileName: "original.pdf",
    contentType: "application/pdf",
    byteSize: bytes.byteLength,
    ownerAccountId: "account:owner",
    createdAt: "2026-09-01T00:00:00.000Z",
    linkedAt: "2026-09-01T01:00:00.000Z",
  }
  const record = await AttachmentRecordContentValue.create(metadata, bytes)
  if (record instanceof Error) throw record
  bytes[0] = 0
  metadata.fileName = "renamed.pdf"
  expect(record.metadata.fileName).toBe("original.pdf")
  expect([...record.contentBytes()]).toEqual([97, 98, 99])
  const encoded = record.toBytes()
  if (encoded instanceof Error) throw encoded
  const restored = await AttachmentRecordContentValue.restore(encoded)
  if (restored instanceof Error) throw restored
  expect(restored.metadata).toEqual(record.metadata)
  expect(restored.contentBytes()).toEqual(record.contentBytes())
  const corrupted = new Uint8Array(encoded)
  corrupted[corrupted.length - 1] = 0
  expect(await AttachmentRecordContentValue.restore(corrupted)).toBeInstanceOf(Error)
  expect(await AttachmentRecordContentValue.restore(encoded.subarray(0, 7))).toBeInstanceOf(Error)
  expect(
    await AttachmentRecordContentValue.create(
      { ...record.metadata, wrappedDek: "must-not-be-stored" },
      record.contentBytes(),
    ),
  ).toBeInstanceOf(Error)
  expect(
    await AttachmentRecordContentValue.create(
      { ...record.metadata, linkedAt: "2026-08-01T00:00:00.000Z" },
      record.contentBytes(),
    ),
  ).toBeInstanceOf(Error)
  expect(
    await AttachmentRecordContentValue.create(
      { ...record.metadata, byteSize: ATTACHMENT_MAX_BYTE_SIZE + 1 },
      new Uint8Array(ATTACHMENT_MAX_BYTE_SIZE + 1),
    ),
  ).toBeInstanceOf(Error)
})
