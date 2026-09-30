import { ReconciliationRunEntity } from "@system/domain/entities/reconciliation-run.entity"
import { describe, expect, test } from "bun:test"

describe("ReconciliationRunEntity", () => {
  test("semantic key単位で一致・差異・片側欠落を分類する", () => {
    const run = ReconciliationRunEntity.create({
      id: "reconciliation:1",
      exchangeId: "exchange:1",
      assertionId: "assertion:1",
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
        id: "reconciliation:1",
        exchangeId: "exchange:1",
        assertionId: "assertion:1",
        localVersion: "7",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        items: [
          { key: "same", localDigest: "a".repeat(64), externalDigest: "a".repeat(64) },
          { key: "same", localDigest: "b".repeat(64), externalDigest: "b".repeat(64) },
        ],
      }),
    ).toEqual(expect.objectContaining({ reason: "duplicate_item" }))
  })
})
