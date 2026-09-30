/** Company の D1 / SQLite 一意制約違反を構造化情報優先で判定する。 */
export function isCompanyUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false

  if ("code" in error && error.code === "SQLITE_CONSTRAINT_UNIQUE") return true

  if ("cause" in error && isCompanyUniqueConstraintError(error.cause)) return true

  return (
    "message" in error &&
    typeof error.message === "string" &&
    /UNIQUE constraint failed/i.test(error.message)
  )
}
