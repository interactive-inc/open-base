import { describe, expect, test } from "vite-plus/test"
import { formatEpochMilliseconds } from "@/app/(app)/system/integration-exchanges/[exchangeId]/_lib/format-epoch-milliseconds"

describe("formatEpochMilliseconds", () => {
  test("epoch を日本時間の表示へ直す", () => {
    expect(formatEpochMilliseconds(Date.UTC(2026, 3, 1))).toBe("2026/04/01 09:00")
  })

  test("Date が扱えない数値はハイフンにする", () => {
    expect(formatEpochMilliseconds(Number.MAX_SAFE_INTEGER)).toBe("-")
    expect(formatEpochMilliseconds(Number.NaN)).toBe("-")
  })
})
