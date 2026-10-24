export const refreshTokenRotationDecisions = Object.freeze([
  "rotated",
  "reused",
  "invalid",
] as const)

export type RefreshTokenRotationDecision = (typeof refreshTokenRotationDecisions)[number]
