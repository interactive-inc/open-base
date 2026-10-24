const MAX_CANDIDATES = 20

/** UI のカンマ・空白区切り入力を API の従業員ID配列に変換する。 */
export function parseCandidateEmployeeIds(raw: string): ReadonlyArray<string> | null {
  const values = raw.trim().split(/[\s,]+/)

  if (values.length === 0 || values[0] === "") {
    return null
  }

  const candidates: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    if (value.length > 128) {
      return null
    }

    if (seen.has(value) === false) {
      seen.add(value)
      candidates.push(value)
    }
  }

  if (candidates.length === 0 || candidates.length > MAX_CANDIDATES) {
    return null
  }

  return candidates
}
