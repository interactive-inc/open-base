/** 会社の言語とtimezoneが実行環境で解釈可能であることを確認する。 */
export function isCompanyLocaleAndTimeZone(locale: string, timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(locale, { timeZone }).format(0)
    return true
  } catch {
    return false
  }
}
