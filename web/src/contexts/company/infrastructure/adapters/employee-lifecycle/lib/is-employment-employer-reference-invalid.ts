/** 雇用主の期間不整合によるDB拒否を、通信障害や競合と区別する。 */
export function isEmploymentEmployerReferenceInvalid(error: unknown): boolean {
  const visited = new Set<Error>()
  while (error instanceof Error && !visited.has(error)) {
    visited.add(error)
    if (error.message.includes("company_employment_employer_reference_invalid")) return true
    error = error.cause
  }
  return false
}
