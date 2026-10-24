/** publicEmployeeBindingStatement の結果を判定する。読めない結果も不完全として扱う。 */
export function checkPublicEmployeeBindings(result: D1Result | undefined): Error | null {
  if (result === undefined || !result.success)
    return new Error("failed to verify Company employee public bindings")
  if (result.results.length !== 0) return new Error("Company employee public binding is incomplete")
  return null
}
