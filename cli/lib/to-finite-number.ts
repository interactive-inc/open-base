import { UsageError } from "@/lib/errors"

/**
 * 文字列フラグを有限数へ変換する。未指定・空文字・空白・非数値・NaN・Infinity は UsageError にする。
 * Number("") や Number(" ") は 0 を返し isFinite を通過してしまうため、先に空文字を弾く。
 */
export function toFiniteNumber(value: string | undefined, flagName: string): number {
  if (value === undefined || value.trim() === "") {
    throw new UsageError(`${flagName} には数値を指定してください`)
  }

  const parsed = Number(value)

  if (Number.isFinite(parsed) === false) {
    throw new UsageError(`${flagName} には数値を指定してください`)
  }

  return parsed
}
