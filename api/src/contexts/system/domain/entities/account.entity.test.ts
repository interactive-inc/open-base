import { testAccountId } from "@/contexts/system/test/system-test-id.test-support"
import { AccountEntity } from "@system/domain/entities/account.entity"
import { InvalidAccountError } from "@system/domain/errors"
import { describe, expect, test } from "bun:test"

const CREATED_AT = new Date("2026-08-11T00:00:00.000Z")
const UPDATED_AT = new Date("2026-08-11T00:01:00.000Z")
const CHANGED_AT = new Date("2026-08-11T00:02:00.000Z")

function accountProps(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id: testAccountId("account-1"),
    status: "active",
    tokenVersion: 3,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  }
}

function requireAccount(input: unknown): AccountEntity {
  const account = AccountEntity.create(input)
  expect(account).toBeInstanceOf(AccountEntity)
  if (account instanceof Error) throw account
  return account
}

describe("AccountEntity", () => {
  test("認証主体に必要な最小状態だけを保持する", () => {
    const account = requireAccount(accountProps())

    expect(account).toMatchObject({
      id: testAccountId("account-1"),
      status: "active",
      tokenVersion: 3,
    })
    expect("employeeId" in account).toBe(false)
    expect("organizationId" in account).toBe(false)
    expect("email" in account).toBe(false)
    expect("displayName" in account).toBe(false)
  })

  test("状態変更とSession失効を単一のimmutable transitionにする", () => {
    const active = requireAccount(accountProps())
    const suspended = active.suspend(CHANGED_AT)
    expect(suspended).toBeInstanceOf(AccountEntity)
    if (suspended instanceof Error) throw suspended

    expect(suspended).toMatchObject({ status: "suspended", tokenVersion: 4 })
    expect(active).toMatchObject({ status: "active", tokenVersion: 3 })
    expect(suspended.updatedAt).toEqual(CHANGED_AT)
  })

  test("明示的な全Session失効でも状態を変えずtokenVersionを増やす", () => {
    const account = requireAccount(accountProps())
    const invalidated = account.invalidateSessions(CHANGED_AT)
    expect(invalidated).toBeInstanceOf(AccountEntity)
    if (invalidated instanceof Error) throw invalidated

    expect(invalidated).toMatchObject({ status: "active", tokenVersion: 4 })
    expect(invalidated.updatedAt).toEqual(CHANGED_AT)
  })

  test("同じ状態への再適用は冪等でtokenVersionを消費しない", () => {
    const account = requireAccount(accountProps())

    expect(account.activate(CHANGED_AT)).toBe(account)
  })

  test("管理停止中のAccountEntityを認証lockへ弱めない", () => {
    const suspended = requireAccount(accountProps({ status: "suspended" }))

    expect(suspended.lock(CHANGED_AT)).toBe(suspended)
  })

  test("閉鎖済みAccountEntityを通常の状態遷移から再開しない", () => {
    const closed = requireAccount(
      accountProps({ status: "suspended", closedAt: UPDATED_AT, updatedAt: UPDATED_AT }),
    )

    expect(closed.closedAt).toEqual(UPDATED_AT)
    expect(closed.activate(CHANGED_AT)).toEqual(
      expect.objectContaining({ reason: "account_closed" }),
    )
  })

  test("lock・管理停止・復旧はいずれも既存Sessionを失効する", () => {
    const active = requireAccount(accountProps())
    const locked = active.lock(CHANGED_AT)
    if (locked instanceof Error) throw locked
    const suspended = locked.suspend(new Date(CHANGED_AT.getTime() + 1))
    if (suspended instanceof Error) throw suspended
    const resumed = suspended.activate(new Date(CHANGED_AT.getTime() + 2))
    if (resumed instanceof Error) throw resumed

    expect(locked).toMatchObject({ status: "locked", tokenVersion: 4 })
    expect(suspended).toMatchObject({ status: "suspended", tokenVersion: 5 })
    expect(resumed).toMatchObject({ status: "active", tokenVersion: 6 })
  })

  test("入力とgetterのDateを変更してもaggregate内部の時刻は変わらない", () => {
    const createdAt = new Date(CREATED_AT)
    const updatedAt = new Date(UPDATED_AT)
    const account = requireAccount(accountProps({ createdAt, updatedAt }))

    createdAt.setUTCFullYear(2030)
    updatedAt.setUTCFullYear(2030)
    account.createdAt.setUTCFullYear(2031)
    account.updatedAt.setUTCFullYear(2031)

    expect(account.createdAt).toEqual(CREATED_AT)
    expect(account.updatedAt).toEqual(UPDATED_AT)
    expect(Object.isFrozen(account)).toBe(true)
  })

  test.each([
    [accountProps({ extra: true }), "invalid_shape"],
    [accountProps({ id: "" }), "invalid_shape"],
    [accountProps({ status: "disabled" }), "invalid_shape"],
    [accountProps({ tokenVersion: -1 }), "invalid_shape"],
    [accountProps({ tokenVersion: 1.5 }), "invalid_shape"],
    [accountProps({ tokenVersion: Number.MAX_SAFE_INTEGER + 1 }), "invalid_shape"],
    [accountProps({ status: "active", closedAt: UPDATED_AT }), "invalid_closed_state"],
    [
      accountProps({
        status: "suspended",
        closedAt: new Date(CREATED_AT.getTime() - 1),
      }),
      "invalid_closed_state",
    ],
    [accountProps({ updatedAt: new Date(CREATED_AT.getTime() - 1) }), "update_before_creation"],
  ] as const)("不正なshapeとlifecycleをfail closedで拒否する", (input, reason) => {
    const account = AccountEntity.create(input)

    expect(account).toBeInstanceOf(InvalidAccountError)
    expect(account instanceof InvalidAccountError ? account.reason : null).toBe(reason)
  })

  test("時刻逆行とtokenVersion overflowをfail closedで拒否する", () => {
    const account = requireAccount(accountProps())
    const exhausted = requireAccount(accountProps({ tokenVersion: Number.MAX_SAFE_INTEGER }))

    expect(account.suspend(new Date(UPDATED_AT.getTime() - 1))).toEqual(
      expect.objectContaining({ reason: "transition_before_last_update" }),
    )
    expect(account.suspend(new Date(Number.NaN))).toEqual(
      expect.objectContaining({ reason: "invalid_shape" }),
    )
    expect(exhausted.invalidateSessions(CHANGED_AT)).toEqual(
      expect.objectContaining({ reason: "token_version_exhausted" }),
    )
  })
})
