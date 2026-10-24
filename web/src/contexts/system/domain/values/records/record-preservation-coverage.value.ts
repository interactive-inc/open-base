import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"

/** 確認した原記録の集合と保全先の集合を、順序に依存せず一対一で照合する。 */
export class RecordPreservationCoverageValue {
  private constructor(readonly recordCount: number) {
    Object.freeze(this)
  }

  static create(
    expected: ReadonlyArray<PreservedRecordSourceValue>,
    preserved: ReadonlyArray<PreservedRecordSourceValue>,
  ): RecordPreservationCoverageValue | Error {
    const originals = RecordPreservationCoverageValue.index(expected)
    if (originals instanceof Error) return originals
    const copies = RecordPreservationCoverageValue.index(preserved)
    if (copies instanceof Error) return copies
    if (originals.size !== copies.size) {
      return new Error("preserved record coverage differs from source snapshot")
    }
    for (const entry of originals) {
      const copy = copies.get(entry[0])
      if (copy === undefined || !entry[1].matchesSource(copy)) {
        return new Error("preserved record is missing or differs from source snapshot")
      }
    }
    return new RecordPreservationCoverageValue(originals.size)
  }

  private static index(
    records: ReadonlyArray<PreservedRecordSourceValue>,
  ): Map<string, PreservedRecordSourceValue> | Error {
    const indexed = new Map<string, PreservedRecordSourceValue>()
    for (const record of records) {
      const identity = JSON.stringify([
        record.props.sourceNamespace,
        record.props.ownerContext,
        record.props.recordKind,
        record.props.recordId,
        record.props.sourceRevision,
      ])
      if (indexed.has(identity)) return new Error("duplicate source record identity")
      indexed.set(identity, record)
    }
    return indexed
  }
}
