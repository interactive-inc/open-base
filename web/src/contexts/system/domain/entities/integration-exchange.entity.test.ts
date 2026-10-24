import { IntegrationExchangeEntity } from "@system/domain/entities/integration-exchange.entity"
import { describe, expect, test } from "bun:test"

const pending = {
  id: "exchange:1",
  connectorId: "connector:1",
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
} as const

describe("IntegrationExchangeEntity", () => {
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
})
