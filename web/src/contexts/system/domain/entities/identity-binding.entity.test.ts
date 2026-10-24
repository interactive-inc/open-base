import { testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { describe, expect, test } from "bun:test"
import { IdentityBindingEntity } from "@system/domain/entities/identity-binding.entity"
import { InvalidIdentityBindingError } from "@system/domain/errors"

const CREATED_AT = new Date("2026-08-11T00:00:00.000Z")
const ACTIVATED_AT = new Date("2026-08-11T00:01:00.000Z")
const REVOKED_AT = new Date("2026-08-11T00:02:00.000Z")

function bindingProps(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id: testLiteralId("identity-1"),
    accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
    provider: "oidc",
    subject: "Subject-A",
    createdAt: CREATED_AT,
    activatedAt: null,
    revokedAt: null,
    ...overrides,
  }
}

function requireBinding(input: unknown): IdentityBindingEntity {
  const binding = IdentityBindingEntity.create(input)
  expect(binding).toBeInstanceOf(IdentityBindingEntity)
  if (binding instanceof Error) throw binding
  return binding
}

describe("IdentityBindingEntity", () => {
  test("Accountへのpending bindingを作り、provider subjectを正規化しない", () => {
    const binding = requireBinding(bindingProps())

    expect(binding).toMatchObject({
      id: testLiteralId("identity-1"),
      accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
      provider: "oidc",
      subject: "Subject-A",
      state: "pending",
    })
    expect("employeeId" in binding).toBe(false)
    expect("email" in binding).toBe(false)
    expect("passwordHash" in binding).toBe(false)
  })

  test("activationとrevocationから状態を導出し、履歴時点の有効性を判定する", () => {
    const pending = requireBinding(bindingProps())
    const active = pending.activate(ACTIVATED_AT)
    expect(active).toBeInstanceOf(IdentityBindingEntity)
    if (active instanceof Error) throw active

    expect(active.state).toBe("active")
    expect(active.wasActiveAt(new Date(ACTIVATED_AT.getTime() - 1))).toBe(false)
    expect(active.wasActiveAt(ACTIVATED_AT)).toBe(true)

    const revoked = active.revoke(REVOKED_AT)
    expect(revoked).toBeInstanceOf(IdentityBindingEntity)
    if (revoked instanceof Error) throw revoked

    expect(revoked.state).toBe("revoked")
    expect(revoked.wasActiveAt(new Date(REVOKED_AT.getTime() - 1))).toBe(true)
    expect(revoked.wasActiveAt(REVOKED_AT)).toBe(false)
    expect(revoked.activate(new Date(REVOKED_AT.getTime() + 1))).toEqual(
      expect.objectContaining({ reason: "revoked_identity_activation" }),
    )
  })

  test("同じtransitionの再実行は最初のlifecycle factを変えない", () => {
    const active = requireBinding(bindingProps({ activatedAt: ACTIVATED_AT }))
    const revoked = active.revoke(REVOKED_AT)
    if (revoked instanceof Error) throw revoked

    expect(active.activate(new Date(ACTIVATED_AT.getTime() + 60_000))).toBe(active)
    expect(revoked.revoke(new Date(REVOKED_AT.getTime() + 60_000))).toBe(revoked)
    expect(active.activatedAt).toEqual(ACTIVATED_AT)
    expect(revoked.revokedAt).toEqual(REVOKED_AT)
  })

  test("入力とgetterのDateを変更してもaggregate内部の時刻は変わらない", () => {
    const createdAt = new Date(CREATED_AT)
    const binding = requireBinding(bindingProps({ createdAt }))

    createdAt.setUTCFullYear(2030)
    binding.createdAt.setUTCFullYear(2031)

    expect(binding.createdAt).toEqual(CREATED_AT)
    expect(Object.isFrozen(binding)).toBe(true)
  })

  test.each([
    [bindingProps({ extra: true }), "invalid_shape"],
    [bindingProps({ id: "" }), "invalid_shape"],
    [bindingProps({ accountId: "" }), "invalid_shape"],
    [bindingProps({ provider: "saml" }), "invalid_shape"],
    [bindingProps({ subject: "subject\nvalue" }), "invalid_shape"],
    [
      bindingProps({ activatedAt: new Date(CREATED_AT.getTime() - 1) }),
      "activation_before_creation",
    ],
    [bindingProps({ revokedAt: new Date(CREATED_AT.getTime() - 1) }), "revocation_before_creation"],
    [
      bindingProps({
        activatedAt: ACTIVATED_AT,
        revokedAt: new Date(ACTIVATED_AT.getTime() - 1),
      }),
      "revocation_before_activation",
    ],
  ] as const)("不正なshapeとlifecycleをfail closedで拒否する", (input, reason) => {
    const binding = IdentityBindingEntity.create(input)

    expect(binding).toBeInstanceOf(InvalidIdentityBindingError)
    expect(binding instanceof InvalidIdentityBindingError ? binding.reason : null).toBe(reason)
  })
})
