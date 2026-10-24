import { describe, expect, it } from "vite-plus/test"
import { toEntityId } from "@/lib/form/to-entity-id"

describe("toEntityId", () => {
  it("accepts current integer ids and UUIDs as strings", () => {
    expect(toEntityId("12")).toBe("12")
    expect(toEntityId(" 12 ")).toBe("12")
    expect(toEntityId("0b7d6c1e-8f5a-4c3b-9a2d-1e0f7c6b5a49")).toBe(
      "0b7d6c1e-8f5a-4c3b-9a2d-1e0f7c6b5a49",
    )
  })

  it("rejects missing, blank, path-like and overlong values", () => {
    for (const value of [null, undefined, "", " ", "../1", "1/2", "a b", "-1", "x".repeat(65)]) {
      expect(toEntityId(value)).toBeNull()
    }
    expect(toEntityId(new File([], "id"))).toBeNull()
  })
})
