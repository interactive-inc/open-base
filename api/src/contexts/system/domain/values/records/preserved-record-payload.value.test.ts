import { RECORD_CONTENT_MAX_SIZE } from "@system/domain/catalogs/records/record-payload-format.catalog"
import { PreservedRecordPayloadValue } from "@system/domain/values/records/preserved-record-payload.value"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { expect, test } from "bun:test"

const sourceInput = {
  sourceNamespace: "source-tenant-1",
  ownerContext: "sample-records",
  recordKind: "record",
  recordId: "original-1",
  formatId: "sample-record",
  formatVersion: 1,
  sourceRevision: null,
  sourceRecordedAt: null,
  capturedAt: "2026-09-13T00:00:00.000Z",
  contentDigest: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
}
const source = PreservedRecordSourceValue.create(sourceInput)
if (source instanceof Error) throw source
const payload = { version: 1, source: sourceInput, contentBase64: "YWJj" }

test("原記録のバイト列を復元し、元にない来歴はnullのまま保持する", async () => {
  const restored = await PreservedRecordPayloadValue.restore(
    new TextEncoder().encode(JSON.stringify(payload)),
    source,
  )
  if (restored instanceof Error) throw restored
  expect([...restored.content.toBytes()]).toEqual([97, 98, 99])
  expect(restored.source.props.sourceRevision).toBeNull()
  expect(restored.source.props.sourceRecordedAt).toBeNull()
})

test("未知の保存形式・異なる出所・取得日時・不正な本文を復元成功と扱わない", async () => {
  for (const invalid of [
    { ...payload, version: 2 },
    { ...payload, source: { ...sourceInput, sourceNamespace: "source-tenant-2" } },
    { ...payload, source: { ...sourceInput, formatVersion: 2 } },
    { ...payload, source: { ...sourceInput, capturedAt: "2026-09-14T00:00:00.000Z" } },
    { ...payload, contentBase64: "YWJk" },
    { ...payload, contentBase64: "YWJj\n" },
    { ...payload, contentBase64: "YWJj=" },
    { ...payload, injectedField: true },
  ]) {
    expect(
      await PreservedRecordPayloadValue.restore(
        new TextEncoder().encode(JSON.stringify(invalid)),
        source,
      ),
    ).toBeInstanceOf(Error)
  }
  expect(await PreservedRecordPayloadValue.restore(new Uint8Array([0xff]), source)).toBeInstanceOf(
    Error,
  )
})

test("binary形式は長さ・出所・本文の改変を拒否し、別形式として解釈し直さない", async () => {
  const record = await PreservedRecordPayloadValue.create(source, new TextEncoder().encode("abc"))
  if (record instanceof Error) throw record
  const bytes = record.toBinary()
  if (bytes instanceof Error) throw bytes
  const restored = await PreservedRecordPayloadValue.restore(bytes, source, "binary")
  if (restored instanceof Error) throw restored
  expect([...restored.content.toBytes()]).toEqual([97, 98, 99])
  const changed = new Uint8Array(bytes)
  changed[changed.length - 1] = 0
  const wrongLength = new Uint8Array(bytes)
  new DataView(wrongLength.buffer).setUint32(4, 0xffffffff, false)
  const trailing = new Uint8Array(bytes.length + 1)
  trailing.set(bytes)
  for (const invalid of [
    changed,
    wrongLength,
    trailing,
    bytes.subarray(0, bytes.length - 1),
    bytes.subarray(0, 7),
  ]) {
    expect(await PreservedRecordPayloadValue.restore(invalid, source, "binary")).toBeInstanceOf(
      Error,
    )
  }
  expect(await PreservedRecordPayloadValue.restore(bytes, source, "json")).toBeInstanceOf(Error)
  expect(
    await PreservedRecordPayloadValue.restore(
      new TextEncoder().encode(JSON.stringify(payload)),
      source,
      "binary",
    ),
  ).toBeInstanceOf(Error)
})

test("通常添付の25MiB上限までbinary保全して復元し、保全本文の上限を1byte超えるデータを拒否する", async () => {
  const bytes = new Uint8Array(25 * 1024 * 1024)
  bytes[0] = 255
  bytes[bytes.length - 1] = 128
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
  const largeSource = PreservedRecordSourceValue.create({ ...sourceInput, contentDigest: digest })
  if (largeSource instanceof Error) throw largeSource
  const record = await PreservedRecordPayloadValue.create(largeSource, bytes)
  if (record instanceof Error) throw record
  const encoded = record.toBinary()
  if (encoded instanceof Error) throw encoded
  expect(encoded.byteLength).toBeGreaterThan(bytes.byteLength)
  expect(encoded.byteLength).toBeLessThan(bytes.byteLength + 16 * 1024 + 8)
  const restored = await PreservedRecordPayloadValue.restore(encoded, largeSource, "binary")
  if (restored instanceof Error) throw restored
  const content = restored.content.toBytes()
  expect(content.byteLength).toBe(bytes.byteLength)
  expect(content[0]).toBe(255)
  expect(content[content.length - 1]).toBe(128)
  expect(
    await PreservedRecordPayloadValue.create(
      largeSource,
      new Uint8Array(RECORD_CONTENT_MAX_SIZE + 1),
    ),
  ).toBeInstanceOf(Error)
})
