import { describe, expect, test } from "bun:test"
import { refreshTokenRotationDecisions } from "@system/domain/definitions/auth/refresh-token-rotation-decision.definition"

describe("RefreshTokenRotationDecision", () => {
  test("defines the closed System rotation vocabulary", () => {
    expect(refreshTokenRotationDecisions).toEqual(["rotated", "reused", "invalid"])
    expect(Object.isFrozen(refreshTokenRotationDecisions)).toBe(true)
  })
})
