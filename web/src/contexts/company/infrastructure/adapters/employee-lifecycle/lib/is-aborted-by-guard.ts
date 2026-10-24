const BATCH_ABORT_SENTINEL = "malformed JSON"

/** CompanyのD1 batch guardによる意図的なrollbackかを判定する。 */
export function isAbortedByGuard(error: unknown): boolean {
  const visited = new Set<Error>()
  while (error instanceof Error && !visited.has(error)) {
    visited.add(error)
    if (
      error.message.includes(BATCH_ABORT_SENTINEL) ||
      /\borganization revision conflict\b/.test(error.message) ||
      /\bcompany_(?:resource_)?revision_conflict\b/.test(error.message)
    )
      return true
    error = error.cause
  }
  return false
}
