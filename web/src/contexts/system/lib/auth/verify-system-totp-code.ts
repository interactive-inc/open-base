import { generateSystemTotpCode } from "@system/lib/auth/generate-system-totp-code"
import { systemTotpStepAt } from "@system/lib/auth/system-totp-step-at"

/** 端末の時計のずれを前後1区間（30秒）まで許す。 */
const ALLOWED_STEP_DRIFT = 1

export type SystemTotpMatch = Readonly<{ step: number }>

/**
 * 入力されたコードが、前後1区間のどれかと一致すれば一致した区間を返す。
 * `lastUsedStep` 以前の区間は一致しても受け付けず、同じコードの使い回しを止める。
 */
export async function verifySystemTotpCode(
  input: Readonly<{ secret: string; code: string; now: Date; lastUsedStep: number | null }>,
): Promise<SystemTotpMatch | null | Error> {
  const code = input.code.replace(/\s/g, "")
  if (!/^\d{6}$/.test(code)) return null

  const current = systemTotpStepAt(input.now)
  let matched: number | null = null

  for (let drift = -ALLOWED_STEP_DRIFT; drift <= ALLOWED_STEP_DRIFT; drift += 1) {
    const step = current + drift
    const expected = await generateSystemTotpCode(input.secret, step)
    if (expected instanceof Error) return expected
    // 一致してもループを抜けず、区間ごとの比較時間を揃える。
    if (constantTimeEqual(expected, code) && matched === null) matched = step
  }

  if (matched === null) return null
  if (input.lastUsedStep !== null && matched <= input.lastUsedStep) return null

  return Object.freeze({ step: matched })
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false

  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return difference === 0
}
