import { z } from "zod"

/** 256-bit opaque tokenのSHA-256 digest。raw tokenはDomainにも永続化にも渡さない。 */
export const zSessionTokenHash = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .brand<"SessionTokenHash">()

export type SessionTokenHash = z.infer<typeof zSessionTokenHash>
