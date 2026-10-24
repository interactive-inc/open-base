import type { AccessTokenProfile } from "@system/lib/auth/access-token-service"

export const SYSTEM_ACCESS_TOKEN_ISSUER = "urn:system:account"
export const SYSTEM_ACCESS_TOKEN_AUDIENCE = "urn:system:api"
export const SYSTEM_ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60

export const SYSTEM_ACCESS_TOKEN_PROFILE = Object.freeze({
  issuer: SYSTEM_ACCESS_TOKEN_ISSUER,
  audience: SYSTEM_ACCESS_TOKEN_AUDIENCE,
  purpose: "api-session",
  maxAgeSeconds: SYSTEM_ACCESS_TOKEN_MAX_AGE_SECONDS,
}) satisfies AccessTokenProfile
