import { SystemAuditPageBoundaryValue } from "@system/domain/values/audit/system-audit-page-boundary.value"
import { describe, expect, test } from "bun:test"

const eventId = "0190a001-0000-7000-8000-000000000001"

describe("SystemAuditPageBoundaryValue", () => {
  test("書き出した文字列を読み戻すと同じ発生時刻とIDになる", () => {
    for (const occurredAtEpochMilliseconds of [1_767_225_600_000, 0, -1]) {
      const boundary = SystemAuditPageBoundaryValue.from({ occurredAtEpochMilliseconds, eventId })
      if (boundary instanceof Error) throw boundary

      const parsed = SystemAuditPageBoundaryValue.parse(boundary.toString())

      expect(parsed).toEqual(boundary)
    }
  })

  test("形式の違う文字列・安全な整数でない時刻・UUIDでないIDは受け付けない", () => {
    for (const text of [
      "",
      "broken",
      `-0.${eventId}`,
      `--1.${eventId}`,
      `01.${eventId}`,
      `1.5.${eventId}`,
      "1.0190A001-0000-7000-8000-000000000001",
      "1.0190a001-0000-0000-8000-000000000001",
      `99999999999999999.${eventId}`,
      `1 .${eventId}`,
    ])
      expect(SystemAuditPageBoundaryValue.parse(text)).toBeInstanceOf(Error)
    expect(
      SystemAuditPageBoundaryValue.from({ occurredAtEpochMilliseconds: 0.5, eventId }),
    ).toBeInstanceOf(Error)
  })
})
