export const sessionUseRejections = Object.freeze([
  "expired",
  "invalid_clock",
  "not_yet_valid",
  "revoked",
  "rotated",
] as const)
export type SessionUseRejection = (typeof sessionUseRejections)[number]
