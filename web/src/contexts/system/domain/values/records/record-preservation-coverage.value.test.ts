import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { RecordPreservationCoverageValue } from "@system/domain/values/records/record-preservation-coverage.value"
import { expect, test } from "bun:test"

const firstInput = {
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

const first = PreservedRecordSourceValue.create(firstInput)
if (first instanceof Error) throw first
const second = PreservedRecordSourceValue.create({ ...firstInput, recordId: "original-2" })
if (second instanceof Error) throw second

test("順序が異なっても原記録と保全先の同じ集合を照合できる", () => {
  const verified = RecordPreservationCoverageValue.create([first, second], [second, first])
  if (verified instanceof Error) throw verified
  expect(verified.recordCount).toBe(2)
})

test("欠落・余分な原記録・重複は件数が同じでも保全完了と扱わない", () => {
  expect(RecordPreservationCoverageValue.create([first, second], [first])).toBeInstanceOf(Error)
  expect(RecordPreservationCoverageValue.create([first], [first, second])).toBeInstanceOf(Error)
  expect(RecordPreservationCoverageValue.create([first, second], [first, first])).toBeInstanceOf(
    Error,
  )
  expect(RecordPreservationCoverageValue.create([first, first], [first, first])).toBeInstanceOf(
    Error,
  )
})

test("元IDが一致しても別の出所や取得後の内容変更を受け入れない", () => {
  for (const input of [
    { ...firstInput, sourceNamespace: "source-tenant-2" },
    { ...firstInput, contentDigest: "b".repeat(64) },
    { ...firstInput, formatVersion: 2 },
    { ...firstInput, sourceRecordedAt: "2026-09-12T00:00:00.000Z" },
  ]) {
    const changed = PreservedRecordSourceValue.create(input)
    if (changed instanceof Error) throw changed
    expect(RecordPreservationCoverageValue.create([first], [changed])).toBeInstanceOf(Error)
  }
})
