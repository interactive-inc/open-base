import { getAcceptQuality } from "@system/interface/problem-details/lib/get-accept-quality"

/** 明示的かつ選択可能なapplication/problem+jsonだけをopt-inとして扱う。 */
export function acceptsSystemProblemDetails(accept: string | null): boolean {
  if (accept === null) return false

  for (const mediaRange of accept.split(",")) {
    const segments = mediaRange.split(";")
    const mediaType = segments[0]?.trim().toLowerCase()

    if (mediaType !== "application/problem+json") continue
    if (mediaRange.includes('"') || mediaRange.includes("\\")) continue
    if (getAcceptQuality(segments.slice(1)) > 0) return true
  }

  return false
}
