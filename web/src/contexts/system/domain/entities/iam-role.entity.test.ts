import { IamRoleEntity } from "@system/domain/entities/iam-role.entity"
import { InvalidIamRoleError } from "@system/domain/errors"
import { describe, expect, test } from "bun:test"

const CREATED_AT = new Date("2026-08-11T00:00:00.000Z")
const UPDATED_AT = new Date("2026-08-11T00:01:00.000Z")

function roleProps(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id: "a290ac92-bf4b-434b-8443-8b6ceeb1cb85",
    key: "system:operator",
    kind: "custom",
    name: "Operator",
    permissionKeys: ["iam:read", "system:admin"],
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  }
}

function requireRole(input: unknown): IamRoleEntity {
  const role = IamRoleEntity.create(input)
  expect(role).toBeInstanceOf(IamRoleEntity)
  if (role instanceof Error) throw role
  return role
}

describe("IamRoleEntity", () => {
  test("namespaced permissionだけを決定的な順序で保持する", () => {
    const role = requireRole(roleProps())

    expect(role.permissionKeys).toEqual(["iam:read", "system:admin"])
    expect(role.hasPermission("iam:read")).toBe(true)
    expect(Object.isFrozen(role.permissionKeys)).toBe(true)
    expect("scope" in role).toBe(false)
    expect("organizationId" in role).toBe(false)
    expect("facilityId" in role).toBe(false)
  })

  test("Role keyはpermissionとは独立にhyphenを含むnamespaced識別子を許可する", () => {
    expect(requireRole(roleProps({ key: "example:resource-manager" })).key).toBe(
      "example:resource-manager",
    )
  })

  test("Role keyはopaque識別子の数字開始segmentを許可する", () => {
    expect(requireRole(roleProps({ key: "company:role:1f0db135" })).key).toBe(
      "company:role:1f0db135",
    )
  })

  test("Roleが宣言したresource typeにだけbindingできる", () => {
    const global = requireRole(roleProps())
    const scoped = requireRole(roleProps({ resourceType: "example:resource" }))

    expect(global.acceptsBindingResource(null)).toBe(true)
    expect(global.acceptsBindingResource("example:resource")).toBe(false)
    expect(scoped.acceptsBindingResource("example:resource")).toBe(true)
    expect(scoped.acceptsBindingResource(null)).toBe(false)
  })

  test("custom Roleのpermissionをimmutableに置換する", () => {
    const role = requireRole(roleProps({ permissionKeys: ["iam:read"] }))
    const updated = role.replacePermissions(["iam:read", "iam:write"], UPDATED_AT)
    expect(updated).toBeInstanceOf(IamRoleEntity)
    if (updated instanceof Error) throw updated

    expect(updated.permissionKeys).toEqual(["iam:read", "iam:write"])
    expect(updated.updatedAt).toEqual(UPDATED_AT)
    expect(role.permissionKeys).toEqual(["iam:read"])
  })

  test("managed Roleのpermission変更を拒否する", () => {
    const role = requireRole(roleProps({ kind: "managed" }))

    expect(role.replacePermissions(["iam:read"], UPDATED_AT)).toEqual(
      expect.objectContaining({ reason: "managed_role_mutation" }),
    )
  })

  test("同じpermission集合への再適用は冪等で、時刻逆行は拒否する", () => {
    const role = requireRole(roleProps())

    expect(role.replacePermissions([...role.permissionKeys], UPDATED_AT)).toBe(role)
    expect(
      role.replacePermissions([...role.permissionKeys], new Date(CREATED_AT.getTime() - 1)),
    ).toEqual(expect.objectContaining({ reason: "update_before_last_update" }))
  })

  test("Dateの可変参照を保持・公開しない", () => {
    const createdAt = new Date(CREATED_AT)
    const role = requireRole(roleProps({ createdAt, updatedAt: createdAt }))

    createdAt.setUTCFullYear(2030)
    role.createdAt.setUTCFullYear(2031)

    expect(role.createdAt).toEqual(CREATED_AT)
    expect(Object.isFrozen(role)).toBe(true)
  })

  test.each([
    [roleProps({ extra: true }), "invalid_shape"],
    [roleProps({ key: "operator" }), "invalid_shape"],
    [roleProps({ permissionKeys: ["iam:read", "iam:read"] }), "duplicate_permissions"],
    [roleProps({ permissionKeys: ["system:admin", "iam:read"] }), "permissions_not_sorted"],
    [roleProps({ permissionKeys: ["invalid"] }), "invalid_shape"],
    [roleProps({ updatedAt: new Date(CREATED_AT.getTime() - 1) }), "update_before_creation"],
  ] as const)("破損Roleをfail closedで拒否する", (input, reason) => {
    const role = IamRoleEntity.create(input)

    expect(role).toBeInstanceOf(InvalidIamRoleError)
    expect(role instanceof InvalidIamRoleError ? role.reason : null).toBe(reason)
  })
})
