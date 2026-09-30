import { canWriteEmployeeAttributes } from "@/contexts/company/domain/policies/employee-attribute-write.policy"
import { expect, test } from "bun:test"

test("System管理・包括write・属性writeだけに労務属性の書込を許す", () => {
  expect(canWriteEmployeeAttributes(new Set(["system:admin"]))).toBe(true)
  expect(canWriteEmployeeAttributes(new Set(["employee:write"]))).toBe(true)
  expect(canWriteEmployeeAttributes(new Set(["employee:write:attributes"]))).toBe(true)
  expect(canWriteEmployeeAttributes(new Set(["employee:write:basic"]))).toBe(false)
})
