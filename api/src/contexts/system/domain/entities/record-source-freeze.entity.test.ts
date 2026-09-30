import { expect, test } from "bun:test"
import { RecordSourceFreezeEntity } from "@system/domain/entities/record-source-freeze.entity"

const initial = {
  id: "00000000-0000-4000-8000-000000000001",
  sourceNamespace: "example-record-source",
  ownerContext: "example-business",
  actorAccountId: "df97195b-6fbe-475a-9293-f76fae1d4d5d",
  reason: "Preserve records before retiring the source",
  createdAt: "2026-09-01T00:00:00.000Z",
  auditEventId: "00000000-0000-4000-8000-000000000002",
  revision: 1,
  release: null,
}

const release = {
  actorAccountId: "0577b586-229a-435a-9088-dcc77f6cc2ec",
  reason: "Resume source writes before starting another collection",
  at: "2026-09-02T00:00:00.000Z",
  auditEventId: "00000000-0000-4000-8000-000000000003",
}

test("停止の解除は元の世代を復活させず、開始と解除の主体・理由を保つ", () => {
  const frozen = RecordSourceFreezeEntity.create(initial)
  if (frozen instanceof Error) throw frozen
  const released = frozen.release(release)
  if (released instanceof Error) throw released
  expect(frozen.matchesActiveGeneration(initial)).toBe(true)
  expect(released.matchesActiveGeneration(initial)).toBe(false)
  expect(released.snapshot).toEqual({ ...initial, revision: 2, release })
  expect(frozen.snapshot.release).toBeNull()
  expect(released.release(release)).toBeInstanceOf(Error)
})

test("別の世代・保存元・所有業務では停止中の同じ記録集合と扱わない", () => {
  const frozen = RecordSourceFreezeEntity.create(initial)
  if (frozen instanceof Error) throw frozen
  for (const input of [
    { ...initial, id: "00000000-0000-4000-8000-000000000004" },
    { ...initial, sourceNamespace: "other-source" },
    { ...initial, ownerContext: "other-business" },
  ])
    expect(frozen.matchesActiveGeneration(input)).toBe(false)
})

test("解除前後の版・時刻・監査の不整合と理由の欠落を復元しない", () => {
  for (const input of [
    { ...initial, revision: 2 },
    { ...initial, release },
    { ...initial, revision: 2, release: { ...release, at: "2026-08-31T00:00:00.000Z" } },
    { ...initial, revision: 2, release: { ...release, auditEventId: initial.auditEventId } },
    { ...initial, reason: " " },
    { ...initial, actorAccountId: " " },
    { ...initial, revision: 2, release: { ...release, reason: " " } },
  ])
    expect(RecordSourceFreezeEntity.create(input)).toBeInstanceOf(Error)
})
