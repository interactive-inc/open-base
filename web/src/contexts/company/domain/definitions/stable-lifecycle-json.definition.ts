function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    )
  }
  return value
}

/**
 * オブジェクトのキーを再帰的にソートして安定した JSON 文字列にする。
 * フィンガープリント算出でキー順の揺れを排除するために使う
 */
export function stableLifecycleJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}
