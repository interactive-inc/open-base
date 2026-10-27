/** 読み違えやすい 0/o・1/l/i を除いた小文字と数字。照合側（normalize）も同じ文字だけを受け付ける。 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
export const SYSTEM_TOTP_RECOVERY_CODE_COUNT = 10
const GROUP_LENGTH = 5

/**
 * 認証アプリを使えなくなったときの復旧コードを作る。各コードは約 49 bit の乱数を
 * 5 文字 2 組（`abcde-fghjk`）で表す。
 */
export function generateSystemTotpRecoveryCodes(): ReadonlyArray<string> {
  return Object.freeze(
    Array.from({ length: SYSTEM_TOTP_RECOVERY_CODE_COUNT }, () => generateCode()),
  )
}

function generateCode(): string {
  const characters: Array<string> = []
  // 256 は 31 で割り切れないので、余りの範囲（248 以上）を捨てて文字の出方を揃える。
  const limit = 256 - (256 % ALPHABET.length)

  while (characters.length < GROUP_LENGTH * 2) {
    const bytes = new Uint8Array(GROUP_LENGTH * 2)
    crypto.getRandomValues(bytes)
    for (const byte of bytes) {
      if (byte < limit && characters.length < GROUP_LENGTH * 2) {
        characters.push(ALPHABET[byte % ALPHABET.length] ?? "")
      }
    }
  }

  return `${characters.slice(0, GROUP_LENGTH).join("")}-${characters.slice(GROUP_LENGTH).join("")}`
}
