/** 認証アプリのワンタイムコード（RFC 6238 TOTP）の 1 区間の長さ。認証アプリの多くが既定で読む 30 秒に固定する。 */
export const SYSTEM_TOTP_PERIOD_SECONDS = 30

export function systemTotpStepAt(now: Date): number {
  return Math.floor(now.getTime() / 1_000 / SYSTEM_TOTP_PERIOD_SECONDS)
}
