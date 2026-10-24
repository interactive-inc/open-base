import { describe, expect, test } from "bun:test"
import { PermissionValue } from "@system/domain/values/iam/permission.value"
import { createScopedPermissionChecker } from "@system/domain/policies/scoped-permission.policy"

const read = PermissionValue.known("resource:read")
const write = PermissionValue.known("resource:write")

describe("createScopedPermissionChecker", () => {
  test("global permission applies to every scope", () => {
    const permissions = createScopedPermissionChecker(new Set([read.key]), new Map())

    expect(permissions.canAt(read, "scope-1")).toBe(true)
    expect(permissions.canAt(read, "scope-2")).toBe(true)
  })

  test("scoped permission applies only to its scope", () => {
    const permissions = createScopedPermissionChecker(
      new Set(),
      new Map([["scope-1", new Set([write.key])]]),
    )

    expect(permissions.canAt(write, "scope-1")).toBe(true)
    expect(permissions.canAt(write, "scope-2")).toBe(false)
    expect(permissions.canAt(write, null)).toBe(true)
  })

  test("system administrator bypasses scoped checks", () => {
    const permissions = createScopedPermissionChecker(new Set(["system:admin"]), new Map())

    expect(permissions.canAt(write, "scope-1")).toBe(true)
  })
})
