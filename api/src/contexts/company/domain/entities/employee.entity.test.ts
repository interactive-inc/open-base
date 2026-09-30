import { testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { EmployeeEntity } from "@/contexts/company/domain/entities/employee.entity"
import { InvalidEmployeeError } from "@/contexts/company/domain/errors"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { describe, expect, test } from "bun:test"

const canonical = {
  id: restoreWorkforceId("employee", testLiteralId("employee:1")),
  officialName: "山田 太郎",
  employeeCode: "E-001",
  email: "taro@example.com",
  phone: null,
} as const

describe("EmployeeEntity", () => {
  test("restores and freezes a canonical Employee profile", () => {
    const employee = EmployeeEntity.restore(canonical)

    expect(employee).toBeInstanceOf(EmployeeEntity)
    expect(Object.isFrozen(employee)).toBe(true)
  })

  test("rejects blank, padded, controlled, and oversized profile values", () => {
    for (const officialName of ["", " Taro", "Taro\u0000", "x".repeat(201)]) {
      expect(EmployeeEntity.restore({ ...canonical, officialName })).toBeInstanceOf(
        InvalidEmployeeError,
      )
    }
  })
})
