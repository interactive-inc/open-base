import { testAccountId } from "@/contexts/system/test/system-test-id.test-support"
import { SystemDeliveryEntity } from "@system/domain/entities/system-delivery.entity"
import { InvalidSystemDeliveryError } from "@system/domain/errors"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { describe, expect, test } from "bun:test"

const start = new Date("2026-01-01T00:00:00.000Z")
const accountId = zAccountId.parse("75effc00-0878-4178-8d76-277086315849")

describe("SystemDeliveryEntity", () => {
  test("lease・heartbeat・成功をtokenと期限へ束縛する", () => {
    const queued = createDelivery(3)
    const leased = queued.claim(accountId, "a".repeat(64), start, 10_000)
    expect(leased).toBeInstanceOf(SystemDeliveryEntity)
    if (!(leased instanceof SystemDeliveryEntity)) return
    expect(leased.attempt).toBe(1)
    const heartbeat = leased.heartbeat(
      accountId,
      "a".repeat(64),
      new Date(start.getTime() + 1_000),
      10_000,
    )
    expect(heartbeat).toBeInstanceOf(SystemDeliveryEntity)
    if (!(heartbeat instanceof SystemDeliveryEntity)) return
    expect(
      heartbeat.succeed(accountId, "b".repeat(64), new Date(start.getTime() + 2_000)),
    ).toBeInstanceOf(InvalidSystemDeliveryError)
    expect(
      heartbeat.succeed(
        zAccountId.parse(testAccountId("worker:2")),
        "a".repeat(64),
        new Date(start.getTime() + 2_000),
      ),
    ).toBeInstanceOf(InvalidSystemDeliveryError)
    expect(
      heartbeat.succeed(accountId, "a".repeat(64), new Date(start.getTime() + 2_000)),
    ).toMatchObject({ status: "succeeded" })
  })

  test("retry上限とlease失効をdead letterへ単調遷移する", () => {
    const first = createDelivery(1).claim(accountId, "a".repeat(64), start, 1_000)
    expect(first).toBeInstanceOf(SystemDeliveryEntity)
    if (!(first instanceof SystemDeliveryEntity)) return
    expect(
      first.fail(
        accountId,
        "a".repeat(64),
        "remote.unavailable",
        new Date(start.getTime() + 500),
        new Date(start.getTime() + 2_000),
      ),
    ).toMatchObject({ status: "dead_letter", attempt: 1 })
    expect(first.recover(new Date(start.getTime() + 1_000))).toMatchObject({
      status: "dead_letter",
      lastErrorCode: "lease.expired",
    })
  })
})

function createDelivery(maxAttempts: number): SystemDeliveryEntity {
  const delivery = SystemDeliveryEntity.create({
    id: "01900054-0000-7000-8000-000000000001",
    kind: "job",
    operationKey: "record.process",
    payloadDigest: "1".repeat(64),
    idempotencyKey: "command:1",
    status: "queued",
    attempt: 0,
    maxAttempts,
    availableAt: start,
    leaseAccountId: null,
    leaseTokenHash: null,
    leaseExpiresAt: null,
    lastErrorCode: null,
    createdAt: start,
    updatedAt: start,
    completedAt: null,
  })
  if (delivery instanceof Error) throw delivery
  return delivery
}
