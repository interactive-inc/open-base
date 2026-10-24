import { expect, test } from "bun:test"
import { RecordCoveragePageEntity } from "@system/domain/entities/record-coverage-page.entity"

const source = {
  sourceNamespace: "example-source",
  ownerContext: "example",
  recordKind: "record",
  formatId: "example-record",
  formatVersion: 1,
  recordId: "one",
  sourceRevision: null,
  sourceRecordedAt: null,
  capturedAt: "2026-09-01T00:00:00.000Z",
  contentDigest: "a".repeat(64),
}
const firstInput = () => ({
  id: crypto.randomUUID(),
  freezeId: crypto.randomUUID(),
  sourceNamespace: source.sourceNamespace,
  ownerContext: source.ownerContext,
  recordKind: source.recordKind,
  sequence: 1,
  previousDigest: null,
  afterCursor: null,
  nextCursor: "page-two",
  purpose: "archive",
  checkedAt: source.capturedAt,
  actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
  records: [{ preservedRecordId: crypto.randomUUID(), source }],
})

test("最初から連続するページだけを同じ停止世代へ結び、完了後の追加を拒否する", async () => {
  const input = firstInput()
  const first = await RecordCoveragePageEntity.create(input, null)
  if (first instanceof Error) throw first
  const next = {
    ...input,
    id: crypto.randomUUID(),
    sequence: 2,
    previousDigest: first.digest,
    afterCursor: input.nextCursor,
    nextCursor: null,
    records: [],
  }
  const final = await RecordCoveragePageEntity.create(next, first)
  expect(final).toBeInstanceOf(RecordCoveragePageEntity)
  if (final instanceof Error) throw final
  expect(
    await RecordCoveragePageEntity.create(
      {
        ...next,
        id: crypto.randomUUID(),
        sequence: 3,
        previousDigest: final.digest,
        afterCursor: null,
      },
      final,
    ),
  ).toBeInstanceOf(Error)
  for (const replacement of [
    { sequence: 3 },
    { previousDigest: "0".repeat(64) },
    { afterCursor: "skipped" },
    { freezeId: crypto.randomUUID() },
    { ownerContext: "other" },
    { sourceNamespace: "other" },
    { recordKind: "other" },
    { checkedAt: "2026-08-31T00:00:00.000Z" },
    { id: input.id },
  ]) {
    expect(
      await RecordCoveragePageEntity.create({ ...next, ...replacement }, first),
    ).toBeInstanceOf(Error)
  }
  expect(await RecordCoveragePageEntity.create({ ...input, sequence: 2 }, null)).toBeInstanceOf(
    Error,
  )
  expect(
    await RecordCoveragePageEntity.create({ ...input, afterCursor: "skip-first" }, null),
  ).toBeInstanceOf(Error)
})

test("ページ内の重複・異なる原記録・未進行の空ページを拒否し、確定内容を不変にする", async () => {
  const input = firstInput()
  for (const records of [
    [],
    [input.records[0], input.records[0]],
    [{ preservedRecordId: crypto.randomUUID(), source: { ...source, ownerContext: "other" } }],
  ]) {
    expect(await RecordCoveragePageEntity.create({ ...input, records }, null)).toBeInstanceOf(Error)
  }
  const page = await RecordCoveragePageEntity.create(input, null)
  if (page instanceof Error) throw page
  const replay = await RecordCoveragePageEntity.create(input, null)
  if (replay instanceof Error) throw replay
  expect(replay.digest).toBe(page.digest)
  expect(await RecordCoveragePageEntity.restore(page.snapshot, page.digest)).toMatchObject({
    digest: page.digest,
  })
  expect(
    await RecordCoveragePageEntity.restore(
      { ...page.snapshot, actorAccountId: "other" },
      page.digest,
    ),
  ).toBeInstanceOf(Error)
  expect(await RecordCoveragePageEntity.restore(page.snapshot, "0".repeat(64))).toBeInstanceOf(
    Error,
  )
  expect(Object.isFrozen(page.snapshot.records)).toBe(true)
  input.records[0]!.source.contentDigest = "b".repeat(64)
  const changed = await RecordCoveragePageEntity.create(input, null)
  if (changed instanceof Error) throw changed
  expect(changed.digest).not.toBe(page.digest)
})
