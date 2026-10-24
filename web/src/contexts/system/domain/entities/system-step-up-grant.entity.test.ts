import { SystemStepUpGrantEntity } from "@system/domain/entities/system-step-up-grant.entity"
import { describe, expect, test } from "bun:test"

const accountId = "12345678-1234-4abc-8def-1234567890ab" as const

describe("SystemStepUpGrantEntity", () => {
  test("Accountとhashへ束縛した短命grantをimmutableに生成する", () => {
    const issuedAt = new Date("2026-08-31T00:00:00.000Z")
    const grant = SystemStepUpGrantEntity.create({
      id: "step-up:1",
      accountId,
      tokenHash: "a".repeat(64),
      method: "password",
      issuedAt,
      expiresAt: new Date("2026-08-31T00:05:00.000Z"),
    })

    expect(grant).toBeInstanceOf(SystemStepUpGrantEntity)
    if (!(grant instanceof SystemStepUpGrantEntity)) return
    issuedAt.setUTCFullYear(2030)
    expect(grant.issuedAt.toISOString()).toBe("2026-08-31T00:00:00.000Z")
    expect(grant.isUsableAt(new Date("2026-08-31T00:04:59.999Z"))).toBe(true)
    expect(grant.isUsableAt(grant.expiresAt)).toBe(false)
    expect(Object.isFrozen(grant)).toBe(true)
  })

  test("壊れたhashと有効期間を拒否する", () => {
    expect(
      SystemStepUpGrantEntity.create({
        id: "step-up:1",
        accountId,
        tokenHash: "raw-secret",
        method: "password",
        issuedAt: new Date("2026-08-31T00:00:00.000Z"),
        expiresAt: new Date("2026-08-31T00:05:00.000Z"),
      }),
    ).toBeInstanceOf(Error)
    expect(
      SystemStepUpGrantEntity.create({
        id: "step-up:1",
        accountId,
        tokenHash: "a".repeat(64),
        method: "password",
        issuedAt: new Date("2026-08-31T00:05:00.000Z"),
        expiresAt: new Date("2026-08-31T00:05:00.000Z"),
      }),
    ).toBeInstanceOf(Error)
  })
})
