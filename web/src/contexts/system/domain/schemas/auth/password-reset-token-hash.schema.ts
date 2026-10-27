import { z } from "zod"

/** 256-bit password reset tokenのSHA-256 digest。raw tokenは永続化しない。 */
export const passwordResetTokenHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .brand<"PasswordResetTokenHash">()

export type PasswordResetTokenHash = z.infer<typeof passwordResetTokenHashSchema>
