import { z } from "zod"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

export const ACCESS_TOKEN_TYPE = "at+jwt"

export const zAccessTokenClaims = z
  .object({
    sub: zAccountId,
    ver: z.number().int().nonnegative(),
    purpose: z.enum(["web-session", "mobile-session", "api-session"]),
    iss: z.string().min(1),
    aud: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
    jti: z.string().min(1),
    iat: z.number().int().nonnegative(),
    issuedAtMs: z.number().int().nonnegative(),
    sid: z
      .string()
      .regex(/^\S{1,255}$/)
      .optional(),
    machineCredentialId: z
      .string()
      .regex(/^\S{1,255}$/)
      .optional(),
    exp: z.number().int().positive(),
  })
  .strict()
  .refine(
    (claims) => claims.machineCredentialId === undefined || claims.purpose === "api-session",
    "machine credentials require an API access token",
  )
  .refine(
    (claims) => claims.sid === undefined || claims.machineCredentialId === undefined,
    "session-bound tokens cannot carry a machine credential",
  )

export type AccessTokenClaims = z.infer<typeof zAccessTokenClaims>
