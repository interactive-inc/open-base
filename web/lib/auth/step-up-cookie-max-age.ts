const MAX_SECONDS = 300

/**
 * step-up grant の失効時刻から cookie の maxAge（秒）を求める。
 * 解釈できない値と既に過ぎた時刻は null を返し、呼び出し側に cookie を書かせない。
 * grant の寿命は API 側で 5 分なので、時刻がずれていても上限を超えないよう丸める。
 */
export function stepUpCookieMaxAge(expiresAt: string, now: Date): number | null {
  const expiresAtMilliseconds = Date.parse(expiresAt)

  if (Number.isNaN(expiresAtMilliseconds)) {
    return null
  }

  const remainingSeconds = Math.floor((expiresAtMilliseconds - now.getTime()) / 1000)

  if (remainingSeconds <= 0) {
    return null
  }

  if (remainingSeconds > MAX_SECONDS) {
    return MAX_SECONDS
  }

  return remainingSeconds
}
