import { InvalidRoleBindingError } from "@system/domain/errors"
import { RoleBindingEntity } from "@system/domain/entities/role-binding.entity"
import { describe, expect, test } from "bun:test"

const CREATED_AT = new Date("2026-08-11T00:00:00.000Z")
const REVOKED_AT = new Date("2026-08-11T00:01:00.000Z")

function bindingProps(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id: "ae18ee9b-62ff-4396-8971-165b0ac77248",
    accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
    roleId: "a290ac92-bf4b-434b-8443-8b6ceeb1cb85",
    resource: null,
    createdAt: CREATED_AT,
    revokedAt: null,
    ...overrides,
  }
}

function requireBinding(input: unknown): RoleBindingEntity {
  const binding = RoleBindingEntity.create(input)
  expect(binding).toBeInstanceOf(RoleBindingEntity)
  if (binding instanceof Error) throw binding
  return binding
}

describe("RoleBindingEntity", () => {
  test("global bindingは全resourceへ、resource bindingは完全一致だけへ適用する", () => {
    const global = requireBinding(bindingProps())
    const scoped = requireBinding(
      bindingProps({ resource: { type: "example:resource", id: "Facility-A" } }),
    )

    expect(global.appliesTo(null)).toBe(true)
    expect(global.appliesTo({ type: "example:resident", id: "resident-1" })).toBe(true)
    expect(scoped.appliesTo(null)).toBe(false)
    expect(scoped.appliesTo({ type: "example:resource", id: "Facility-A" })).toBe(true)
    expect(scoped.appliesTo({ type: "example:resource", id: "facility-a" })).toBe(false)
  })

  test("作成・失効時刻からactive状態を導出し、revocationを冪等にする", () => {
    const binding = requireBinding(bindingProps())
    const revoked = binding.revoke(REVOKED_AT)
    expect(revoked).toBeInstanceOf(RoleBindingEntity)
    if (revoked instanceof Error) throw revoked

    expect(binding.isActiveAt(CREATED_AT)).toBe(true)
    expect(revoked.isActiveAt(new Date(REVOKED_AT.getTime() - 1))).toBe(true)
    expect(revoked.isActiveAt(REVOKED_AT)).toBe(false)
    expect(revoked.revoke(new Date(REVOKED_AT.getTime() + 1))).toBe(revoked)
  })

  test("resourceとDateの可変参照を保持・公開しない", () => {
    const resource = { type: "example:resource", id: "facility-1" }
    const createdAt = new Date(CREATED_AT)
    const binding = requireBinding(bindingProps({ resource, createdAt }))

    resource.id = "changed"
    createdAt.setUTCFullYear(2030)
    binding.createdAt.setUTCFullYear(2031)

    expect(binding.resource).toEqual({ type: "example:resource", id: "facility-1" })
    expect(binding.createdAt).toEqual(CREATED_AT)
    expect(Object.isFrozen(binding.resource)).toBe(true)
    expect(Object.isFrozen(binding)).toBe(true)
  })

  test.each([
    [bindingProps({ extra: true }), "invalid_shape"],
    [bindingProps({ accountId: "" }), "invalid_shape"],
    [bindingProps({ resource: { type: "facility", id: "f-1" } }), "invalid_shape"],
    [bindingProps({ resource: { type: "example:resource", id: "" } }), "invalid_shape"],
    [bindingProps({ revokedAt: new Date(CREATED_AT.getTime() - 1) }), "revocation_before_creation"],
  ] as const)("破損bindingをfail closedで拒否する", (input, reason) => {
    const binding = RoleBindingEntity.create(input)

    expect(binding).toBeInstanceOf(InvalidRoleBindingError)
    expect(binding instanceof InvalidRoleBindingError ? binding.reason : null).toBe(reason)
  })
})
