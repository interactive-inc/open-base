import { describe, expect, test } from "bun:test"
import { InvalidSystemTotpCredentialError } from "@system/domain/errors"
import { SystemTotpCredentialEntity } from "@system/domain/entities/system-totp-credential.entity"

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001"
const NOW = new Date("2026-10-21T00:00:00.000Z")
const HASH_A = "a".repeat(64)
const HASH_B = "b".repeat(64)

function pending() {
  const entity = SystemTotpCredentialEntity.begin({
    accountId: ACCOUNT_ID,
    secretCiphertext: "v1.ciphertext-placeholder",
    now: NOW,
  })
  if (entity instanceof Error) throw entity

  return entity
}

function active() {
  const entity = pending().enable({ step: 10, recoveryCodeHashes: [HASH_A, HASH_B], now: NOW })
  if (entity instanceof Error) throw entity

  return entity
}

describe("SystemTotpCredentialEntity", () => {
  test("登録を始めた直後は pending で、有効にすると active になり復旧コードを持つ", () => {
    expect(pending().isActive).toBe(false)

    const enabled = active()

    expect(enabled.isActive).toBe(true)
    expect(enabled.lastUsedStep).toBe(10)
    expect(enabled.recoveryCodeHashes).toEqual([HASH_A, HASH_B])
    expect(enabled.enabledAt).toEqual(enabled.updatedAt)
    expect(enabled.updatedAt.getTime()).toBeGreaterThan(NOW.getTime())
  })

  test("有効になった登録をもう一度有効にはできない", () => {
    expect(active().enable({ step: 11, recoveryCodeHashes: [], now: NOW })).toBeInstanceOf(
      InvalidSystemTotpCredentialError,
    )
  })

  test("使用済みの区間とそれ以前の区間は使えない", () => {
    expect(active().useStep(10, NOW)).toBeInstanceOf(InvalidSystemTotpCredentialError)
    expect(active().useStep(9, NOW)).toBeInstanceOf(InvalidSystemTotpCredentialError)

    const used = active().useStep(11, NOW)
    if (used instanceof Error) throw used

    expect(used.lastUsedStep).toBe(11)
  })

  test("復旧コードは 1 回だけ使え、使うと一覧から消える", () => {
    const consumed = active().consumeRecoveryCode(HASH_A, NOW)
    if (consumed instanceof Error) throw consumed

    expect(consumed.recoveryCodeHashes).toEqual([HASH_B])
    expect(consumed.consumeRecoveryCode(HASH_A, NOW)).toBeInstanceOf(
      InvalidSystemTotpCredentialError,
    )
  })

  test("更新のたびに updatedAt が前へ進む", () => {
    const enabled = active()
    const used = enabled.useStep(11, NOW)
    if (used instanceof Error) throw used

    expect(used.updatedAt.getTime()).toBeGreaterThan(enabled.updatedAt.getTime())
  })

  test("pending の登録で復旧コードやコードを使えない", () => {
    expect(pending().useStep(11, NOW)).toBeInstanceOf(InvalidSystemTotpCredentialError)
    expect(pending().consumeRecoveryCode(HASH_A, NOW)).toBeInstanceOf(
      InvalidSystemTotpCredentialError,
    )
    expect(pending().replaceRecoveryCodes([HASH_A], NOW)).toBeInstanceOf(
      InvalidSystemTotpCredentialError,
    )
  })

  test("状態と有効にした日時が食い違う行は読み込まない", () => {
    expect(
      SystemTotpCredentialEntity.create({
        accountId: ACCOUNT_ID,
        secretCiphertext: "v1.ciphertext-placeholder",
        status: "active",
        lastUsedStep: null,
        recoveryCodeHashes: [],
        createdAt: NOW,
        updatedAt: NOW,
        enabledAt: null,
      }),
    ).toBeInstanceOf(InvalidSystemTotpCredentialError)
  })
})
