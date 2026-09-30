import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { describe, expect, test } from "bun:test"

describe("AccountId value", () => {
  test("UUIDを文字列のまま保持し、UUIDでないopaque IDを拒否する", () => {
    expect(String(zAccountId.parse("01900061-0000-7000-8000-000000000001"))).toBe(
      "01900061-0000-7000-8000-000000000001",
    )
    expect(zAccountId.safeParse("001").success).toBe(false)
    expect(zAccountId.safeParse("account-a").success).toBe(false)
  })

  test("大文字小文字を正規化しない", () => {
    expect(String(zAccountId.parse("0190006A-0000-7000-8000-00000000000A"))).toBe(
      "0190006A-0000-7000-8000-00000000000A",
    )
    expect(String(zAccountId.parse("0190006a-0000-7000-8000-00000000000a"))).toBe(
      "0190006a-0000-7000-8000-00000000000a",
    )
  })

  test("空文字、255文字超、非文字列を拒否する", () => {
    expect(zAccountId.safeParse("").success).toBe(false)
    expect(zAccountId.safeParse("a".repeat(256)).success).toBe(false)
    expect(zAccountId.safeParse(1).success).toBe(false)
  })
})
