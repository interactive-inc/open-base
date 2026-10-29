import { z } from "zod"

/** 版の入力を丸めず、10進の非負safe integerとして検証する。 */
export const revisionFlag = z
  .string()
  .regex(/^[0-9]+$/)
  .transform(Number)
  .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER))
