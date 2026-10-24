import { InvalidWorkforceIdError } from "@/contexts/company/domain/errors"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { describe, expect, test } from "bun:test"

describe("restoreWorkforceId", () => {
  test("accepts lowercase UUID identifiers", () => {
    expect(String(restoreWorkforceId("employee", "01900061-0000-7000-8000-000000000001"))).toBe(
      "01900061-0000-7000-8000-000000000001",
    )
    expect(String(restoreWorkforceId("employment", "3f2b8c1e-5d4a-4b6c-9e7f-0a1b2c3d4e5f"))).toBe(
      "3f2b8c1e-5d4a-4b6c-9e7f-0a1b2c3d4e5f",
    )
  })

  test("rejects empty, padded, unsafe, and oversized identifiers", () => {
    for (const value of [
      "",
      " employee-1",
      "employee/1",
      "employee:01.HQ",
      "42",
      "01900061-0000-7000-8000-00000000000G",
      "3F2B8C1E-5D4A-4B6C-9E7F-0A1B2C3D4E5F",
      "x".repeat(129),
    ]) {
      expect(() => restoreWorkforceId("employee", value)).toThrow(InvalidWorkforceIdError)
    }
  })
})
