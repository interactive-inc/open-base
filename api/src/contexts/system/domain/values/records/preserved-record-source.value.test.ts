import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { expect, test } from "bun:test"

const source = {
  sourceNamespace: "source-tenant-1",
  ownerContext: "sample-records",
  recordKind: "record",
  formatId: "sample-record-json",
  formatVersion: 1,
  recordId: "original-1",
  sourceRevision: null,
  sourceRecordedAt: null,
  capturedAt: "2026-09-13T00:00:00.000Z",
  contentDigest: "a".repeat(64),
}

test("元版と元記録日時がない場合、取得情報から補完しない", () => {
  const result = PreservedRecordSourceValue.create(source)
  if (result instanceof Error) throw result
  expect(result.props.sourceRevision).toBeNull()
  expect(result.props.sourceRecordedAt).toBeNull()
  expect(result.props.capturedAt).toBe(source.capturedAt)
  expect(Object.isFrozen(result.props)).toBe(true)
  expect(Object.isFrozen(result)).toBe(true)
})

test("未提供の来歴は明示し、省略・空白・不正な値を受け付けない", () => {
  for (const invalid of [
    { ...source, sourceRevision: undefined },
    { ...source, formatId: undefined },
    { ...source, formatVersion: undefined },
    { ...source, formatVersion: 0 },
    { ...source, formatVersion: 1.5 },
    { ...source, sourceNamespace: undefined },
    { ...source, sourceNamespace: " " },
    { ...source, sourceRecordedAt: undefined },
    { ...source, sourceRevision: " " },
    { ...source, recordId: " " },
    { ...source, sourceRecordedAt: "2026-09-14T00:00:00.000Z" },
    { ...source, contentDigest: "invalid" },
    { ...source, fabricatedRevision: 1 },
  ]) {
    expect(PreservedRecordSourceValue.create(invalid)).toBeInstanceOf(Error)
  }
})

test("同じ元版でも内容・来歴・所有者が変われば同じ原記録として照合しない", () => {
  const original = PreservedRecordSourceValue.create(source)
  if (original instanceof Error) throw original
  for (const changed of [
    { ...source, contentDigest: "b".repeat(64) },
    { ...source, ownerContext: "other-records" },
    { ...source, sourceNamespace: "source-tenant-2" },
    { ...source, recordKind: "other" },
    { ...source, formatId: "different-record-json" },
    { ...source, formatVersion: 2 },
    { ...source, recordId: "original-2" },
    { ...source, sourceRevision: "1" },
    { ...source, sourceRecordedAt: "2026-09-12T00:00:00.000Z" },
  ]) {
    const candidate = PreservedRecordSourceValue.create(changed)
    if (candidate instanceof Error) throw candidate
    expect(original.matchesSource(candidate)).toBe(false)
  }
  const repeated = PreservedRecordSourceValue.create({
    ...source,
    capturedAt: "2026-09-14T00:00:00.000Z",
  })
  if (repeated instanceof Error) throw repeated
  expect(original.matchesSource(repeated)).toBe(true)
})
