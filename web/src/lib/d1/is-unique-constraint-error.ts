/**
 * DB ドライバが UNIQUE 制約違反として投げたエラーかを判定する。
 * 構造化情報（code）を最優先し、cause にネストする実装も辿る。
 * Cloudflare D1 は code を露出しないため、最後にメッセージ文字列で補う。
 */
export function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false
  }

  // bun:sqlite / node:sqlite / better-sqlite3 は SQLITE_CONSTRAINT_UNIQUE を露出する。
  if ("code" in error && error.code === "SQLITE_CONSTRAINT_UNIQUE") {
    return true
  }

  if ("cause" in error && isUniqueConstraintError(error.cause)) {
    return true
  }

  // D1 は構造化コードを持たず "D1_ERROR: UNIQUE constraint failed: ..." を投げる。
  if ("message" in error && typeof error.message === "string") {
    return /UNIQUE constraint failed/i.test(error.message)
  }

  return false
}
