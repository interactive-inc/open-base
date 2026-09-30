/** 設定が無いときのSession familyの絶対寿命（30日）。 */
export const DEFAULT_SYSTEM_SESSION_MAX_LIFETIME_SECONDS = 2_592_000

/**
 * `SYSTEM_SESSION_MAX_LIFETIME_SECONDS` を、refreshで延長できないfamilyの絶対寿命（ミリ秒）へ変換する。
 * 未設定なら既定値を使う。空文字・小数・負数・桁あふれは寿命を決められないためErrorを返し、
 * 呼び出し側はSessionの発行と更新を止める。
 */
export function readSystemSessionMaxLifetimeMilliseconds(
  value: string | undefined,
): number | Error {
  if (value === undefined) return DEFAULT_SYSTEM_SESSION_MAX_LIFETIME_SECONDS * 1_000
  if (!/^[1-9][0-9]{0,11}$/.test(value)) {
    return new Error("SYSTEM_SESSION_MAX_LIFETIME_SECONDS must be a positive integer")
  }
  const milliseconds = Number(value) * 1_000

  return Number.isSafeInteger(milliseconds)
    ? milliseconds
    : new Error("SYSTEM_SESSION_MAX_LIFETIME_SECONDS is too large")
}
