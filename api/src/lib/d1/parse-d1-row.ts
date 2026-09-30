import type { z } from "zod"

/** D1 batch の結果から先頭行を Zod で安全にパースする。as キャストの代替。 */
export function parseD1Row<T>(
  result: D1Result<unknown> | undefined,
  schema: z.ZodType<T>,
): T | undefined | Error {
  const row = result?.results?.at(0)

  if (row === undefined) {
    return undefined
  }

  const parsed = schema.safeParse(row)

  if (parsed.success === false) {
    return new Error(`failed to parse D1 row: ${parsed.error.message}`)
  }

  return parsed.data
}
