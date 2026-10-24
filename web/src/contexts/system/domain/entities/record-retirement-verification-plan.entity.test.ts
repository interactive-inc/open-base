import { expect, test } from "bun:test"
import { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"

const input = () => ({
  id: crypto.randomUUID(),
  freezeId: crypto.randomUUID(),
  sourceNamespace: "example-source",
  ownerContext: "example",
  purpose: "archive",
  capability: { revision: 1, recordKinds: ["record", "attachment"] },
  coverage: [
    {
      recordKind: "record",
      terminalPageId: crypto.randomUUID(),
      terminalDigest: "a".repeat(64),
      pageCount: 2,
      recordCount: 12,
    },
    {
      recordKind: "attachment",
      terminalPageId: crypto.randomUUID(),
      terminalDigest: "b".repeat(64),
      pageCount: 1,
      recordCount: 0,
    },
  ],
  actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
  createdAt: "2026-09-14T00:00:00Z",
  auditEventId: crypto.randomUUID(),
})

test("全種別の順序と空種別を固定し、保存した計画から同じ検査位置を解決する", async () => {
  const original = input()
  const plan = await RecordRetirementVerificationPlanEntity.create(original)
  if (plan instanceof Error) throw plan
  expect(plan.totalPages).toBe(3)
  expect(plan.target(1)).toMatchObject({
    recordKind: "record",
    sequence: 1,
    planDigest: plan.digest,
  })
  expect(plan.target(2)).toMatchObject({ recordKind: "record", sequence: 2 })
  expect(plan.target(3)).toMatchObject({ recordKind: "attachment", sequence: 1 })
  for (const ordinal of [0, 4, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
    expect(plan.target(ordinal)).toBeInstanceOf(Error)
  original.capability.recordKinds.reverse()
  const originalFirst = original.coverage[0]
  if (originalFirst === undefined) throw new Error("missing coverage")
  originalFirst.pageCount = 9
  expect(plan.target(2)).toMatchObject({ recordKind: "record", sequence: 2 })
  const restored = await RecordRetirementVerificationPlanEntity.restore(
    JSON.parse(JSON.stringify(plan.snapshot)),
    plan.digest,
  )
  if (restored instanceof Error) throw restored
  expect(restored.target(3)).toEqual(plan.target(3))
  expect(Object.isFrozen(plan.snapshot.coverage[0])).toBe(true)
  expect(
    await RecordRetirementVerificationPlanEntity.restore(
      { ...plan.snapshot, purpose: "different" },
      plan.digest,
    ),
  ).toBeInstanceOf(Error)
})

test("不足・余分・重複・順序違いの種別や集計値の桁溢れを拒否する", async () => {
  const original = input()
  const first = original.coverage[0]
  if (first === undefined) throw new Error("missing coverage")
  for (const changed of [
    { ...original, coverage: original.coverage.slice(1) },
    { ...original, coverage: [...original.coverage, first] },
    { ...original, coverage: [...original.coverage].reverse() },
    {
      ...original,
      capability: { revision: 1, recordKinds: ["record", "record"] },
      coverage: [first, first],
    },
    {
      ...original,
      coverage: original.coverage.map((coverage) => ({
        ...coverage,
        terminalPageId: first.terminalPageId,
      })),
    },
    {
      ...original,
      coverage: original.coverage.map((coverage) => ({
        ...coverage,
        pageCount: Number.MAX_SAFE_INTEGER,
      })),
    },
    {
      ...original,
      coverage: original.coverage.map((coverage) => ({
        ...coverage,
        recordCount: Number.MAX_SAFE_INTEGER,
      })),
    },
  ])
    expect(await RecordRetirementVerificationPlanEntity.create(changed)).toBeInstanceOf(Error)
})
