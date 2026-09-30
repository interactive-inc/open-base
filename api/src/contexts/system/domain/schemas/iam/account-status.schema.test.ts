import { describe, expect, test } from "bun:test"
import { accountStatusSchema } from "@system/domain/schemas/iam/account-status.schema"

describe("accountStatusSchema", () => {
  test("System Accountの3状態を受理する", () => {
    expect(accountStatusSchema.parse("active")).toBe("active")
    expect(accountStatusSchema.parse("suspended")).toBe("suspended")
    expect(accountStatusSchema.parse("locked")).toBe("locked")
  })

  test("旧boolean表現や未知の状態を拒否する", () => {
    for (const status of ["inactive", "disabled", "pending", "", true, false]) {
      expect(accountStatusSchema.safeParse(status).success).toBe(false)
    }
  })
})
