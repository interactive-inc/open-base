import { ExternalAssertionEntity } from "@system/domain/entities/external-assertion.entity"
import { describe, expect, test } from "bun:test"

const assertion = {
  id: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
  connectorId: "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15",
  exchangeId: "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d",
  externalKey: "record:1",
  externalVersion: "1",
  payloadDigest: "b".repeat(64),
  observedAt: new Date("2026-01-01T00:00:00.000Z"),
  receivedAt: new Date("2026-01-01T00:00:01.000Z"),
} as const

describe("ExternalAssertionEntity", () => {
  test("UUIDの主キーと、UUIDではない外部のkey・versionで作成する", () => {
    expect(ExternalAssertionEntity.create(assertion)).toBeInstanceOf(ExternalAssertionEntity)
    expect(ExternalAssertionEntity.create({ ...assertion, exchangeId: null })).toBeInstanceOf(
      ExternalAssertionEntity,
    )
  })

  test("UUIDではない主キーとConnector・交換の参照を拒否する", () => {
    for (const id of [
      "assertion:1",
      "3E5A7C9B-2D4F-4B6A-A8C0-1E3F5A7B9C2D",
      "00000000-0000-0000-0000-000000000000",
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
    ]) {
      for (const field of ["id", "connectorId", "exchangeId"] as const) {
        expect(ExternalAssertionEntity.create({ ...assertion, [field]: id })).toEqual(
          expect.objectContaining({ reason: "invalid_shape" }),
        )
      }
    }
  })
})
