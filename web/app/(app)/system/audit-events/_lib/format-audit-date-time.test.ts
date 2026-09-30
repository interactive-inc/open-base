import { describe, expect, test } from "vite-plus/test"
import { formatAuditDateTime } from "@/app/(app)/system/audit-events/_lib/format-audit-date-time"

describe("formatAuditDateTime", () => {
  test("formats audit order with explicit Japanese locale, Tokyo timezone, and seconds", () => {
    const formatted = formatAuditDateTime("2026-01-01T00:00:05.000Z")

    expect(formatted).toContain("2026")
    expect(formatted).toContain("09:00:05")
    expect(formatted).toMatch(/JST|日本標準時/u)
  })

  test("returns a safe placeholder for an invalid timestamp", () => {
    expect(formatAuditDateTime("not-a-date")).toBe("—")
  })
})
