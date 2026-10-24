import { describe, expect, test } from "bun:test"
import { PermissionValue } from "@system/domain/values/iam/permission.value"

describe("PermissionValue", () => {
  test("accepts a namespaced permission and caches parsed values", () => {
    const first = PermissionValue.from("resource:read:all")
    const second = PermissionValue.from("resource:read:all")

    expect(first).toBeInstanceOf(PermissionValue)
    expect(first?.key).toBe("resource:read:all")
    expect(second).toBe(first)
  })

  test("rejects malformed or unnamespaced values", () => {
    expect(PermissionValue.from("resource")).toBeNull()
    expect(PermissionValue.from("Resource:read")).toBeNull()
    expect(PermissionValue.from("resource::read")).toBeNull()
    expect(() => PermissionValue.known("invalid")).toThrow("Invalid permission key")
  })

  test("compares permissions by canonical key", () => {
    const read = PermissionValue.known("resource:read")
    const write = PermissionValue.known("resource:write")

    expect(read.equals(PermissionValue.known("resource:read"))).toBe(true)
    expect(read.equals(write)).toBe(false)
  })

  test("checks required values and gives system admin the generic bypass", () => {
    const resourceRead = PermissionValue.known("resource:read")

    expect(PermissionValue.hasAny(new Set(["resource:read"]), resourceRead)).toBe(true)
    expect(PermissionValue.hasAny(new Set(["system:admin"]), resourceRead)).toBe(true)
    expect(PermissionValue.hasAny(new Set(), resourceRead)).toBe(false)
    expect(PermissionValue.hasAny(new Set())).toBe(false)
  })
})
