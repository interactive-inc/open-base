import { z } from "zod"

export const recordStorageKeyFingerprintsSchema = z
  .array(
    z
      .strictObject({
        version: z.number().int().positive().safe(),
        digest: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .readonly(),
  )
  .max(200)
  .readonly()
  .refine(
    (keys) =>
      keys.every((key, index) => index === 0 || (keys[index - 1]?.version ?? 0) < key.version),
    "storage key versions must be unique and ascending",
  )
