import { IntegrationExchangeEntity } from "@system/domain/entities/integration-exchange.entity"
import { describe, expect, test } from "bun:test"

const pending = Object.freeze({
  id: "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d",
  connectorId: "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15",
  direction: "outbound",
  operationKey: "record.export",
  idempotencyKey: "command:1",
  payloadDigest: "a".repeat(64),
  status: "pending",
  attempt: 1,
  externalReference: null,
  lastErrorCode: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  completedAt: null,
})

const rejectedIds = [
  "exchange:1",
  "B2D4F6A8-1C3E-4A5B-8C7D-9E0F1A2B3C4D",
  "00000000-0000-0000-0000-000000000000",
  "ffffffff-ffff-ffff-ffff-ffffffffffff",
]

describe("IntegrationExchangeEntity", () => {
  test("同じミリ秒の失敗・retry・成功でも状態と試行の組が変わる", () => {
    const exchange = IntegrationExchangeEntity.create(pending)
    if (exchange instanceof Error) throw exchange
    const failed = exchange.transition("failed", pending.updatedAt, {
      externalReference: null,
      errorCode: "remote.failed",
    })
    if (failed instanceof Error) throw failed
    const retried = failed.transition("pending", pending.updatedAt, {
      externalReference: null,
      errorCode: null,
    })
    if (retried instanceof Error) throw retried
    const succeeded = retried.transition("succeeded", pending.updatedAt, {
      externalReference: "record:1",
      errorCode: null,
    })
    if (succeeded instanceof Error) throw succeeded

    expect(failed.status).toBe("failed")
    expect(failed.attempt).toBe(1)
    expect(retried.status).toBe("pending")
    expect(retried.attempt).toBe(2)
    expect(retried.completedAt).toBeNull()
    expect(succeeded.status).toBe("succeeded")
    expect(succeeded.attempt).toBe(2)
    expect(succeeded.updatedAt).toEqual(pending.updatedAt)
    expect(succeeded.completedAt).toEqual(pending.updatedAt)
  })

  test("失敗・retry・成功を単調な試行履歴として遷移する", () => {
    const exchange = IntegrationExchangeEntity.create(pending)
    expect(exchange).toBeInstanceOf(IntegrationExchangeEntity)
    if (!(exchange instanceof IntegrationExchangeEntity)) return

    const failed = exchange.transition("failed", new Date("2026-01-01T00:01:00.000Z"), {
      externalReference: null,
      errorCode: "remote.unavailable",
    })
    expect(failed).toBeInstanceOf(IntegrationExchangeEntity)
    if (!(failed instanceof IntegrationExchangeEntity)) return

    const retried = failed.transition("pending", new Date("2026-01-01T00:02:00.000Z"), {
      externalReference: null,
      errorCode: null,
    })
    expect(retried).toEqual(expect.objectContaining({ status: "pending", attempt: 2 }))
  })

  test("成功済み交換の再遷移を拒否する", () => {
    const exchange = IntegrationExchangeEntity.create({
      ...pending,
      status: "succeeded",
      completedAt: new Date("2026-01-01T00:01:00.000Z"),
      updatedAt: new Date("2026-01-01T00:01:00.000Z"),
    })
    expect(exchange).toBeInstanceOf(IntegrationExchangeEntity)
    if (!(exchange instanceof IntegrationExchangeEntity)) return

    expect(
      exchange.transition("failed", new Date("2026-01-01T00:02:00.000Z"), {
        externalReference: null,
        errorCode: "remote.failed",
      }),
    ).toEqual(expect.objectContaining({ reason: "invalid_transition" }))
  })

  test("UUIDではない主キーとConnectorの参照を拒否し、意味を持つkeyは文字列のまま受け付ける", () => {
    for (const id of rejectedIds) {
      expect(IntegrationExchangeEntity.create({ ...pending, id })).toEqual(
        expect.objectContaining({ reason: "invalid_shape" }),
      )
      expect(IntegrationExchangeEntity.create({ ...pending, connectorId: id })).toEqual(
        expect.objectContaining({ reason: "invalid_shape" }),
      )
    }
    expect(
      IntegrationExchangeEntity.create({
        ...pending,
        operationKey: "record.export:v2",
        idempotencyKey: "command:1",
      }),
    ).toBeInstanceOf(IntegrationExchangeEntity)
  })
})
