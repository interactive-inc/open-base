import { SYSTEM_TOTP_DIGITS } from "@system/lib/auth/generate-system-totp-code"
import { SYSTEM_TOTP_PERIOD_SECONDS } from "@system/lib/auth/system-totp-step-at"

/** 認証アプリへ渡す `otpauth://totp/` URI。表示名に使う発行者とアカウント名は呼び出し側が決める。 */
export function buildSystemTotpKeyUri(
  input: Readonly<{ secret: string; issuer: string; accountName: string }>,
): string {
  const label = `${encodeURIComponent(input.issuer)}:${encodeURIComponent(input.accountName)}`
  const query = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: "SHA1",
    digits: String(SYSTEM_TOTP_DIGITS),
    period: String(SYSTEM_TOTP_PERIOD_SECONDS),
  })

  return `otpauth://totp/${label}?${query.toString()}`
}
