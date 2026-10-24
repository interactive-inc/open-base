import { createHash } from "node:crypto"
import { expect, test } from "bun:test"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"
import { uuidSchema } from "@/lib/validation/uuid.schema"

test("同じ入力から同じ version 8 の UUID を作り、SHA-256 の先頭と一致する", () => {
  for (const input of ["", "a", "x".repeat(55), "x".repeat(56), "y".repeat(200), "日本語"]) {
    const id = deterministicCompanyId("period", input, 3)
    expect(uuidSchema.safeParse(id).success).toBe(true)
    expect(id).toBe(deterministicCompanyId("period", input, 3))
    const expected = createHash("sha256").update(`period\u0000${input}\u00003`).digest("hex")
    expect(id.replaceAll("-", "").slice(0, 12)).toBe(expected.slice(0, 12))
    expect(id.charAt(14)).toBe("8")
  }
})

test("種類や入力が違えば別の ID になる", () => {
  expect(deterministicCompanyId("period", "a")).not.toBe(deterministicCompanyId("assignment", "a"))
  expect(deterministicCompanyId("period", "a", 1)).not.toBe(
    deterministicCompanyId("period", "a", 2),
  )
})
