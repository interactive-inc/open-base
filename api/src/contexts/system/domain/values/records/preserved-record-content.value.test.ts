import { PreservedRecordContentValue } from "@system/domain/values/records/preserved-record-content.value"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { expect, test } from "bun:test"

const sourceInput = {
  sourceNamespace: "source-tenant-1",
  ownerContext: "sample-records",
  recordKind: "record",
  formatId: "sample-record-json",
  formatVersion: 1,
  recordId: "original-1",
  sourceRevision: null,
  sourceRecordedAt: null,
  capturedAt: "2026-09-13T00:00:00.000Z",
  contentDigest: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
}

test("原文の既知のSHA-256と照合し、一文字の変更と切り詰めを拒否する", async () => {
  const source = PreservedRecordSourceValue.create(sourceInput)
  if (source instanceof Error) throw source
  for (const body of ["ab", "abd", " abc", "abc\n"]) {
    expect(
      await PreservedRecordContentValue.create(source, new TextEncoder().encode(body)),
    ).toBeInstanceOf(Error)
  }
  const content = await PreservedRecordContentValue.create(source, new TextEncoder().encode("abc"))
  if (content instanceof Error) throw content
  expect(new TextDecoder().decode(content.toBytes())).toBe("abc")
})

test("検証中の入力変更と返却バイト列の変更から保全内容を隔離する", async () => {
  const source = PreservedRecordSourceValue.create(sourceInput)
  if (source instanceof Error) throw source
  const bytes = new TextEncoder().encode("abc")
  const pending = PreservedRecordContentValue.create(source, bytes)
  bytes.fill(0)
  const content = await pending
  if (content instanceof Error) throw content
  content.toBytes().fill(0)
  expect(new TextDecoder().decode(content.toBytes())).toBe("abc")
})

test("元の空ファイルを欠落や架空の本文へ置換しない", async () => {
  const source = PreservedRecordSourceValue.create({
    ...sourceInput,
    contentDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  })
  if (source instanceof Error) throw source
  const content = await PreservedRecordContentValue.create(source, new Uint8Array())
  if (content instanceof Error) throw content
  expect(content.toBytes().byteLength).toBe(0)
})
