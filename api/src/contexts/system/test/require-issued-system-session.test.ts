import type { IssueSystemSessionResult } from "@system/domain/definitions/auth/system-session-issuance.definition"
import { zSessionId } from "@system/domain/schemas/auth/session-id.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { requireIssuedSystemSession } from "@system/test/require-issued-system-session.test-support"
import { describe, expect, test } from "bun:test"

describe("requireIssuedSystemSession", () => {
  test("発行済みのSessionをそのまま返す", () => {
    const issued: IssueSystemSessionResult = {
      kind: "issued",
      accountId: zAccountId.parse("0f6cc3a9-017b-4583-bd3c-b5d9c9957a67"),
      tokenVersion: 0,
      accessToken: "access-token",
      rawToken: "raw-token",
      sessionId: zSessionId.parse("5b0a3c0e-6f0e-4c53-9d0b-0b6a5f1f2c11"),
      expiresAt: new Date("2026-01-08T00:00:00.000Z"),
    }

    expect(requireIssuedSystemSession(issued)).toBe(issued)
  })

  test("拒否された発行は理由を付けて失敗させる", () => {
    expect(() =>
      requireIssuedSystemSession({ kind: "rejected", reason: "account_inactive" }),
    ).toThrow("System Session issuance was rejected: account_inactive")
    expect(() =>
      requireIssuedSystemSession({ kind: "rejected", reason: "account_not_found" }),
    ).toThrow("System Session issuance was rejected: account_not_found")
  })

  test("Errorになった発行は原因を付けて失敗させる", () => {
    const cause = new Error("session store is unavailable")

    expect(() => requireIssuedSystemSession(cause)).toThrow("System Session issuance failed")
    expect(captureThrown(() => requireIssuedSystemSession(cause))).toMatchObject({ cause })
  })
})

function captureThrown(operation: () => unknown): unknown {
  try {
    operation()
  } catch (thrown) {
    return thrown
  }

  return null
}
