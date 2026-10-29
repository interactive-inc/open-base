/** 固定namespaceを保ち、URIの各segmentを一度だけ復号して単一segmentへ戻す。 */
export function toFoundationPath(path: string): string | null {
  if (!/^\/(?:system|company)(?:\/|$)/u.test(path)) return null
  if (path.includes("?") || path.includes("#") || path.includes("\\")) return null
  if (
    Array.from(path).some((character) => {
      const code = character.codePointAt(0) ?? 0
      return code <= 32 || code === 127
    })
  )
    return null
  const segments = path.split("/")
  const canonical = ["", segments[1]]
  try {
    for (const segment of segments.slice(2)) {
      const decoded = decodeURIComponent(segment)
      if (decoded === "" || decoded === "." || decoded === "..") return null
      canonical.push(encodeURIComponent(decoded))
    }
    return canonical.join("/")
  } catch {
    return null
  }
}
