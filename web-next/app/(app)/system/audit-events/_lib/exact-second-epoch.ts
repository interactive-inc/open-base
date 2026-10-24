import { z } from "zod"

const exactSecondIsoSchema = z.string().datetime({ offset: true, precision: 0 })

export function exactSecondEpoch(value: string): number | null {
  if (!exactSecondIsoSchema.safeParse(value).success) return null
  const epoch = Date.parse(value)
  return Number.isFinite(epoch) && Number.isSafeInteger(epoch / 1_000) ? epoch : null
}
