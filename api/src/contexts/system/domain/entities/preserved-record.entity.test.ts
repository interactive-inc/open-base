import { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import { expect, test } from "bun:test"

const input = {
  id: crypto.randomUUID(),
  source: {
    sourceNamespace: "source-tenant-1",
    ownerContext: "sample-records",
    recordKind: "record",
    recordId: "original-1",
    formatId: "sample-record",
    formatVersion: 1,
    sourceRevision: null,
    sourceRecordedAt: null,
    capturedAt: "2026-09-13T00:00:00.000Z",
    contentDigest: "a".repeat(64),
  },
  attachmentId: crypto.randomUUID(),
  attachmentDigest: "b".repeat(64),
  preservationId: crypto.randomUUID(),
  disclosurePolicyId: crypto.randomUUID(),
  disclosurePolicyRevision: 1,
  sourceAuthorizationRef: {
    context: "sample-records",
    kind: "export-grant",
    id: "grant-1",
    version: "1",
  },
  actorAccountId: "a3e16d2a-d110-49b0-9ecb-e7b88a1c35ce",
  finalizedAt: "2026-09-13T00:00:01.000Z",
  reason: "Preserve confirmed source",
  auditEventId: crypto.randomUUID(),
}
const hold = {
  id: input.preservationId,
  attachmentId: input.attachmentId,
  sha256: input.attachmentDigest,
  kind: "hold",
  retainUntil: null,
  reason: input.reason,
  actorAccountId: input.actorAccountId,
  createdAt: input.finalizedAt,
  auditEventId: crypto.randomUUID(),
  revision: 1,
  release: null,
}

test("本文の保全対象と確定主体を照合し、別の保全を根拠にしない", () => {
  const record = PreservedRecordEntity.create(input)
  if (record instanceof Error) throw record
  const preservation = AttachmentPreservationEntity.create(hold)
  if (preservation instanceof Error) throw preservation
  expect(record.matchesPreservation(preservation)).toBe(true)
  for (const different of [
    { ...hold, id: crypto.randomUUID() },
    { ...hold, attachmentId: crypto.randomUUID() },
    { ...hold, sha256: "c".repeat(64) },
    { ...hold, actorAccountId: "258bbdaa-4348-4953-bc9b-523250d0062e" },
    { ...hold, createdAt: "2026-09-13T00:00:00.000Z" },
  ]) {
    const mismatch = AttachmentPreservationEntity.create(different)
    if (mismatch instanceof Error) throw mismatch
    expect(record.matchesPreservation(mismatch)).toBe(false)
  }
})

test("取得前の確定や保持・開示・移管根拠の欠落を拒否する", () => {
  for (const invalid of [
    { ...input, finalizedAt: "2026-09-12T00:00:00.000Z" },
    { ...input, disclosurePolicyId: undefined },
    { ...input, disclosurePolicyRevision: 0 },
    { ...input, sourceAuthorizationRef: undefined },
    { ...input, preservationId: undefined },
  ])
    expect(PreservedRecordEntity.create(invalid)).toBeInstanceOf(Error)
  const record = PreservedRecordEntity.create(input)
  if (record instanceof Error) throw record
  expect(Object.isFrozen(record.snapshot.sourceAuthorizationRef)).toBe(true)
  expect(record.snapshot.source.sourceRevision).toBeNull()
  expect(record.snapshot.source.sourceRecordedAt).toBeNull()
})
