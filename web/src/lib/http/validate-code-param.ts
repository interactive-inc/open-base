import { NotFoundError } from "@/lib/http/errors"

/**
 * コード系パスパラメータの最低限検証。空文字と 64 文字超を弾く。
 * 不正値は「対象リソースが存在しない」と等価なので NotFoundError を返す。
 */
const MAX_CODE_LENGTH = 64

export function validateCodeParam(raw: string | undefined, label: string): string {
  const value = raw ?? ""

  if (value === "" || value.length > MAX_CODE_LENGTH) {
    throw new NotFoundError(`${label} not found`)
  }

  return value
}
