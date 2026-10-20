import { ReconciliationRunEntity } from "@system/domain/entities/reconciliation-run.entity"
import { describe, expect, test } from "bun:test"

describe("ReconciliationRunEntity", () => {
  test("semantic key単位で一致・差異・片側欠落を分類する", () => {
    const run = ReconciliationRunEntity.create({
      id: "c7e9a1b3-4d6f-4e8a-b0c2-3d5f7a9b1c4e",
      exchangeId: "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d",
      assertionId: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
      localVersion: "7",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      items: [
        { key: "matched", localDigest: "a".repeat(64), externalDigest: "a".repeat(64) },
        { key: "different", localDigest: "a".repeat(64), externalDigest: "b".repeat(64) },
        { key: "missing-local", localDigest: null, externalDigest: "c".repeat(64) },
        { key: "missing-external", localDigest: "d".repeat(64), externalDigest: null },
      ],
    })
    expect(run).toBeInstanceOf(ReconciliationRunEntity)
    if (!(run instanceof ReconciliationRunEntity)) return

    expect(run.status).toBe("mismatched")
    expect(run.items.map((item) => item.status)).toEqual([
      "matched",
      "different",
      "missing_local",
      "missing_external",
    ])
  })

  test("同じsemantic keyの重複を拒否する", () => {
    expect(
      ReconciliationRunEntity.create({
        id: "c7e9a1b3-4d6f-4e8a-b0c2-3d5f7a9b1c4e",
        exchangeId: "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d",
        assertionId: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
        localVersion: "7",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        items: [
          { key: "same", localDigest: "a".repeat(64), externalDigest: "a".repeat(64) },
          { key: "same", localDigest: "b".repeat(64), externalDigest: "b".repeat(64) },
        ],
      }),
    ).toEqual(expect.objectContaining({ reason: "duplicate_item" }))
  })

  test("UUIDではない主キーと交換・assertionの参照を拒否する", () => {
    const valid = {
      id: "c7e9a1b3-4d6f-4e8a-b0c2-3d5f7a9b1c4e",
      exchangeId: "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d",
      assertionId: "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d",
      localVersion: "7",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      items: [{ key: "record:1", localDigest: "a".repeat(64), externalDigest: "a".repeat(64) }],
    }
    expect(ReconciliationRunEntity.create(valid)).toBeInstanceOf(ReconciliationRunEntity)

    for (const id of [
      "reconciliation:1",
      "C7E9A1B3-4D6F-4E8A-B0C2-3D5F7A9B1C4E",
      "00000000-0000-0000-0000-000000000000",
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
    ]) {
      for (const field of ["id", "exchangeId", "assertionId"] as const) {
        expect(ReconciliationRunEntity.create({ ...valid, [field]: id })).toEqual(
          expect.objectContaining({ reason: "invalid_shape" }),
        )
      }
    }
  })
})
