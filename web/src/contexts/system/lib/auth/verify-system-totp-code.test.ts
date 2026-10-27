import { describe, expect, test } from "bun:test"
import { buildSystemTotpKeyUri } from "@system/lib/auth/build-system-totp-key-uri"
import { generateSystemTotpCode } from "@system/lib/auth/generate-system-totp-code"
import { generateSystemTotpSecret } from "@system/lib/auth/generate-system-totp-secret"
import { systemTotpStepAt } from "@system/lib/auth/system-totp-step-at"
import { verifySystemTotpCode } from "@system/lib/auth/verify-system-totp-code"

/** RFC 6238 付録 B の SHA-1 の鍵（ASCII の "12345678901234567890"）を base32 にしたもの。 */
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"

describe("verifySystemTotpCode", () => {
  test.each([
    [59, "287082"],
    [1_111_111_109, "081804"],
    [1_111_111_111, "050471"],
    [1_234_567_890, "005924"],
    [2_000_000_000, "279037"],
  ])("RFC 6238 のテストベクタ（T=%d）の下 6 桁と一致する", async (seconds, expected) => {
    const step = systemTotpStepAt(new Date(seconds * 1_000))

    expect(await generateSystemTotpCode(RFC_SECRET, step)).toBe(expected)
  })

  test("前後 1 区間のずれまで受け付け、2 区間ずれたコードは拒否する", async () => {
    const now = new Date(1_234_567_890_000)
    const step = systemTotpStepAt(now)
    const previous = await generateSystemTotpCode(RFC_SECRET, step - 1)
    const tooOld = await generateSystemTotpCode(RFC_SECRET, step - 2)
    if (previous instanceof Error || tooOld instanceof Error) throw new Error("setup failed")

    expect(
      await verifySystemTotpCode({ secret: RFC_SECRET, code: previous, now, lastUsedStep: null }),
    ).toEqual({ step: step - 1 })
    expect(
      await verifySystemTotpCode({ secret: RFC_SECRET, code: tooOld, now, lastUsedStep: null }),
    ).toBeNull()
  })

  test("使用済みの区間と、それより前の区間のコードは使い回せない", async () => {
    const now = new Date(1_234_567_890_000)
    const step = systemTotpStepAt(now)
    const code = await generateSystemTotpCode(RFC_SECRET, step)
    if (code instanceof Error) throw code

    expect(
      await verifySystemTotpCode({ secret: RFC_SECRET, code, now, lastUsedStep: step }),
    ).toBeNull()
    expect(
      await verifySystemTotpCode({ secret: RFC_SECRET, code, now, lastUsedStep: step - 1 }),
    ).toEqual({ step })
  })

  test("6 桁の数字でない入力は照合せずに拒否し、空白は無視する", async () => {
    const now = new Date(59_000)

    expect(
      await verifySystemTotpCode({ secret: RFC_SECRET, code: "28708", now, lastUsedStep: null }),
    ).toBeNull()
    expect(
      await verifySystemTotpCode({ secret: RFC_SECRET, code: "abcdef", now, lastUsedStep: null }),
    ).toBeNull()
    expect(
      await verifySystemTotpCode({
        secret: RFC_SECRET,
        code: "287 082",
        now,
        lastUsedStep: null,
      }),
    ).toEqual({ step: 1 })
  })

  test("生成した秘密鍵は 160 bit の base32 で、毎回異なる", () => {
    const first = generateSystemTotpSecret()

    expect(first).toMatch(/^[A-Z2-7]{32}$/)
    expect(generateSystemTotpSecret()).not.toBe(first)
  })

  test("鍵の URI は認証アプリが読む既定のパラメータを持つ", () => {
    const uri = new URL(
      buildSystemTotpKeyUri({
        secret: RFC_SECRET,
        issuer: "Example",
        accountName: "user@example.test",
      }),
    )

    expect(uri.protocol).toBe("otpauth:")
    expect(uri.searchParams.get("secret")).toBe(RFC_SECRET)
    expect(uri.searchParams.get("issuer")).toBe("Example")
    expect(uri.searchParams.get("digits")).toBe("6")
    expect(uri.searchParams.get("period")).toBe("30")
  })

  test("base32 でない秘密鍵はエラーを返す", async () => {
    expect(await generateSystemTotpCode("not-base32!", 1)).toBeInstanceOf(Error)
  })
})
