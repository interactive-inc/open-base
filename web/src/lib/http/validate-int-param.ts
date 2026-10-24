import { NotFoundError } from "@/lib/http/errors"

/**
 * パスパラメータを正の整数に変換する。不正値（空文字・小数・負値・非数・MAX_SAFE_INTEGER 超）は 404。
 * 不正値は「対象リソースが存在しない」と等価なので NotFoundError を返す。
 */
export function validateIntParam(raw: string | undefined, label: string): number {
  const parsed = Number(raw ?? "")

  if (Number.isInteger(parsed) === false || parsed <= 0 || parsed > Number.MAX_SAFE_INTEGER) {
    throw new NotFoundError(`${label} not found`)
  }

  return parsed
}
