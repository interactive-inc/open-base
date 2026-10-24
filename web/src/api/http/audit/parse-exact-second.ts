import { z } from "zod"

const exactSecondIsoSchema = z.string().datetime({ offset: true, precision: 0 })

/** Parses an exact-second ISO instant into safe Unix seconds, rejecting sub-second precision. */
export function parseExactSecond(value: string): number {
  const parsed = exactSecondIsoSchema.safeParse(value)
  if (!parsed.success) throw new Error("timestamp shape is invalid")

  const milliseconds = Date.parse(parsed.data)
  const seconds = milliseconds / 1_000
  if (!Number.isFinite(milliseconds) || !Number.isSafeInteger(seconds)) {
    throw new Error("timestamp is outside the supported range")
  }

  return seconds
}
