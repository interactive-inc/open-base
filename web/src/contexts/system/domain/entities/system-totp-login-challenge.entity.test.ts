import { describe, expect, test } from "bun:test"
import { SystemTotpLoginChallengeEntity } from "@system/domain/entities/system-totp-login-challenge.entity"
import { InvalidSystemTotpLoginChallengeError } from "@system/domain/errors"

const accountId = "00000000-0000-4000-8000-000000000001"
const challengeHash = "a".repeat(64)
const now = new Date("2026-10-21T00:00:00.000Z")

describe("SystemTotpLoginChallengeEntity", () => {
  test("発行した challenge は 5 分間だけコードを受け付ける", () => {
    const challenge = SystemTotpLoginChallengeEntity.issue({
      challengeHash,
      accountId,
      tokenVersion: 3,
      now,
    })
    if (challenge instanceof Error) throw challenge

    expect(challenge.failedAttempts).toBe(0)
    expect(challenge.expiresAt.getTime() - now.getTime()).toBe(5 * 60 * 1_000)
    expect(challenge.acceptsCodeAt(new Date(now.getTime() + 299_999))).toBe(true)
    expect(challenge.acceptsCodeAt(challenge.expiresAt)).toBe(false)
  })

  test("誤りの回数が上限に達した challenge はコードを受け付けない", () => {
    const challenge = SystemTotpLoginChallengeEntity.create({
      challengeHash,
      accountId,
      tokenVersion: 0,
      failedAttempts: SystemTotpLoginChallengeEntity.MAX_FAILED_ATTEMPTS,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    })
    if (challenge instanceof Error) throw challenge

    expect(challenge.acceptsCodeAt(now)).toBe(false)
  })

  test("hash の形や期限の前後が崩れた challenge は作れない", () => {
    expect(
      SystemTotpLoginChallengeEntity.issue({
        challengeHash: "not-a-hash",
        accountId,
        tokenVersion: 0,
        now,
      }),
    ).toBeInstanceOf(InvalidSystemTotpLoginChallengeError)

    const reversed = SystemTotpLoginChallengeEntity.create({
      challengeHash,
      accountId,
      tokenVersion: 0,
      failedAttempts: 0,
      createdAt: now,
      expiresAt: now,
    })
    expect(reversed).toBeInstanceOf(InvalidSystemTotpLoginChallengeError)
    expect(reversed instanceof InvalidSystemTotpLoginChallengeError && reversed.reason).toBe(
      "expiry_before_creation",
    )
  })
})
