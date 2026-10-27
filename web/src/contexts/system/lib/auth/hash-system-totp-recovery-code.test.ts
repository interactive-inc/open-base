import { describe, expect, test } from "bun:test"
import { generateSystemTotpRecoveryCodes } from "@system/lib/auth/generate-system-totp-recovery-codes"
import { hashSystemTotpRecoveryCode } from "@system/lib/auth/hash-system-totp-recovery-code"
import { normalizeSystemTotpRecoveryCode } from "@system/lib/auth/normalize-system-totp-recovery-code"

describe("hashSystemTotpRecoveryCode", () => {
  test("読み違えやすい文字を含まない 10 個の異なるコードを作る", () => {
    const codes = generateSystemTotpRecoveryCodes()

    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const code of codes) {
      expect(code).toMatch(/^[a-hjkmnp-z2-9]{5}-[a-hjkmnp-z2-9]{5}$/)
    }
  })

  test("区切り・空白・大文字小文字の違いは同じ hash になる", async () => {
    const [code] = generateSystemTotpRecoveryCodes()
    if (code === undefined) throw new Error("setup failed")

    const hash = await hashSystemTotpRecoveryCode(code)

    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashSystemTotpRecoveryCode(code.toUpperCase().replace("-", " "))).toBe(hash)
  })

  test("長さや文字が合わない入力は hash せずにエラーを返す", async () => {
    expect(normalizeSystemTotpRecoveryCode("abcde-fghj")).toBeNull()
    expect(normalizeSystemTotpRecoveryCode("abcde-fgh10")).toBeNull()
    expect(await hashSystemTotpRecoveryCode("123456")).toBeInstanceOf(Error)
  })
})
