import { describe, expect, test } from "bun:test"
import { entityIdInput, entityIdSegment, toApiStringId } from "@/lib/entity-id.ts"

describe("entityIdSegment", () => {
  test("整数IDとUUIDをpathのIDとして受け付ける", () => {
    expect(entityIdSegment.safeParse("42").success).toBe(true)
    expect(entityIdSegment.safeParse("0b7a3c1e-2f4d-4e5a-9b8c-7d6e5f4a3b2c").success).toBe(true)
  })

  test("別のpathへ到達させる値を拒否する", () => {
    expect(entityIdSegment.safeParse("../admin").success).toBe(false)
    expect(entityIdSegment.safeParse("1/approve").success).toBe(false)
    expect(entityIdSegment.safeParse("").success).toBe(false)
  })
})

describe("entityIdInput", () => {
  test("文字列の従業員IDをそのままAPIへ渡し、整数も文字列へ揃える", () => {
    const parsed = entityIdInput.parse("E001")
    expect(toApiStringId(parsed)).toBe("E001")
    expect(toApiStringId(entityIdInput.parse(7))).toBe("7")
    expect(toApiStringId(undefined)).toBeUndefined()
  })
})
