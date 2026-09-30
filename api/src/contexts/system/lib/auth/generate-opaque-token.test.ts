import { generateOpaqueToken } from "@system/lib/auth/generate-opaque-token"
import { describe, expect, test } from "bun:test"

describe("generateOpaqueToken", () => {
  test("returns 256 bits as lowercase hexadecimal", () => {
    expect(generateOpaqueToken()).toMatch(/^[0-9a-f]{64}$/)
  })

  test("does not repeat across consecutive generations", () => {
    const tokens = new Set(Array.from({ length: 32 }, generateOpaqueToken))
    expect(tokens.size).toBe(32)
  })
})
