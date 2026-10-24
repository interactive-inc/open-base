import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
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

async function proposal(
  options: {
    record?: unknown
    hold?: unknown
    grants?: unknown
    policyAuditId?: string
    publishedAt?: string
  } = {},
) {
  const record = PreservedRecordEntity.create(options.record ?? input)
  const preservation = AttachmentPreservationEntity.create(options.hold ?? hold)
  const disclosure = PreservedRecordDisclosurePolicyEntity.create({
    id: input.disclosurePolicyId,
    recordId: input.id,
    revision: 1,
    status: "active",
    actorAccountId: input.actorAccountId,
    publishedAt: options.publishedAt ?? input.finalizedAt,
    reason: "Authorized disclosure",
    auditEventId: options.policyAuditId ?? crypto.randomUUID(),
    grants: options.grants ?? [],
  })
  if (record instanceof Error || preservation instanceof Error || disclosure instanceof Error)
    throw new Error("invalid proposal fixture")
  return RecordPreservationProposalValue.create({ record, preservation, disclosure })
}

test("approval digest binds source, preservation and disclosure intent", async () => {
  const original = await proposal()
  if (original instanceof Error) throw original
  for (const changed of [
    { record: { ...input, source: { ...input.source, sourceNamespace: "other-source" } } },
    { record: { ...input, source: { ...input.source, contentDigest: "c".repeat(64) } } },
    {
      record: {
        ...input,
        sourceAuthorizationRef: { ...input.sourceAuthorizationRef, version: "2" },
      },
    },
    { hold: { ...hold, kind: "retention", retainUntil: "2027-01-01T00:00:00.000Z" } },
    {
      grants: [
        {
          accountId: "eb2aaac2-352f-4196-8e01-adea61c54466",
          actions: ["read"],
          purposes: ["review"],
          validFrom: input.finalizedAt,
          validUntil: null,
        },
      ],
    },
  ]) {
    const different = await proposal(changed)
    if (different instanceof Error) throw different
    expect(different.props.digest.equals(original.props.digest)).toBe(false)
  }
})

test("execution-generated audit IDs and finalization time do not change approval intent", async () => {
  const original = await proposal()
  const later = "2026-09-13T00:00:02.000Z"
  const executed = await proposal({
    record: { ...input, finalizedAt: later, auditEventId: crypto.randomUUID() },
    hold: { ...hold, createdAt: later, auditEventId: crypto.randomUUID() },
  })
  if (original instanceof Error || executed instanceof Error) throw new Error("missing proposal")
  expect(executed.props.digest.equals(original.props.digest)).toBe(true)
  expect(JSON.parse(original.props.canonical.toString()).source.sourceRevision).toBeNull()
})

test("proposal rejects disclosure that is not published by finalization", async () => {
  expect(await proposal({ publishedAt: "2026-09-13T00:00:02.000Z" })).toBeInstanceOf(Error)
})

test("approved intent restores without fabricated execution metadata and rejects unexpected authority fields", async () => {
  const original = await proposal()
  if (original instanceof Error) throw original
  const body = JSON.parse(original.props.canonical.toString())
  const restored = await RecordPreservationProposalValue.restore(body)
  if (restored instanceof Error) throw restored
  expect(restored.props.digest.equals(original.props.digest)).toBe(true)
  for (const invalid of [
    { ...body, auditEventId: crypto.randomUUID() },
    { ...body, finalizedAt: input.finalizedAt },
    { ...body, approved: true },
    { ...body, version: 2 },
    { ...body, disclosure: { ...body.disclosure, revision: 2 } },
    {
      ...body,
      preservation: { ...body.preservation, kind: "hold", retainUntil: "2027-01-01T00:00:00.000Z" },
    },
    { ...body, preservation: { ...body.preservation, kind: "retention", retainUntil: null } },
    { ...body, source: { ...body.source, sourceRevision: undefined } },
    {
      ...body,
      disclosure: {
        ...body.disclosure,
        grants: [
          {
            accountId: "eb2aaac2-352f-4196-8e01-adea61c54466",
            actions: ["read"],
            purposes: ["review"],
            validFrom: input.finalizedAt,
            validUntil: input.finalizedAt,
          },
        ],
      },
    },
  ])
    expect(await RecordPreservationProposalValue.restore(invalid)).toBeInstanceOf(Error)
})

test("execution derives fresh audit metadata while preserving approved intent and rejecting another actor or expired retention", async () => {
  const original = await proposal()
  if (original instanceof Error) throw original
  const at = new Date(input.finalizedAt)
  const command = original.toFinalization({ actorAccountId: input.actorAccountId, at })
  const retry = original.toFinalization({
    actorAccountId: input.actorAccountId,
    at: new Date(at.getTime() + 1000),
  })
  if (command instanceof Error || retry instanceof Error) throw new Error("missing finalization")
  expect(command.record.snapshot.finalizedAt).toBe(at.toISOString())
  expect(command.record.snapshot.source).toEqual(input.source)
  expect(
    new Set([
      command.record.snapshot.auditEventId,
      command.disclosure.snapshot.auditEventId,
      command.preservation.snapshot.auditEventId,
      retry.record.snapshot.auditEventId,
    ]).size,
  ).toBe(4)
  const reconstructed = await RecordPreservationProposalValue.create(retry)
  if (reconstructed instanceof Error) throw reconstructed
  expect(reconstructed.props.digest.equals(original.props.digest)).toBe(true)
  expect(
    original.toFinalization({ actorAccountId: "13174c44-fe69-4065-9e59-6319c84a1f8a", at }),
  ).toBeInstanceOf(Error)
  expect(
    original.toFinalization({ actorAccountId: input.actorAccountId, at: new Date("invalid") }),
  ).toBeInstanceOf(Error)
  expect(
    original.toFinalization({
      actorAccountId: input.actorAccountId,
      at: new Date(Date.parse(input.source.capturedAt) - 1),
    }),
  ).toBeInstanceOf(Error)
  const retention = await RecordPreservationProposalValue.restore({
    ...JSON.parse(original.props.canonical.toString()),
    preservation: {
      id: hold.id,
      kind: "retention",
      retainUntil: "2026-09-14T00:00:00.000Z",
      reason: hold.reason,
    },
  })
  if (retention instanceof Error) throw retention
  expect(
    retention.toFinalization({
      actorAccountId: input.actorAccountId,
      at: new Date("2026-09-14T00:00:00.000Z"),
    }),
  ).toBeInstanceOf(Error)
})

test("request composition pins server source, storage and actor without accepting execution metadata", async () => {
  const original = await proposal()
  if (original instanceof Error) throw original
  const source = PreservedRecordSourceValue.create(input.source)
  if (source instanceof Error) throw source
  const request = {
    reason: input.reason,
    preservation: { kind: hold.kind, retainUntil: hold.retainUntil, reason: hold.reason },
    disclosure: { reason: "Authorized disclosure", grants: [] },
  }
  const trusted = {
    request,
    recordId: input.id,
    source,
    actorAccountId: input.actorAccountId,
    attachmentId: input.attachmentId,
    attachmentDigest: input.attachmentDigest,
    sourceAuthorizationRef: input.sourceAuthorizationRef,
    preservationId: input.preservationId,
    disclosurePolicyId: input.disclosurePolicyId,
  }
  const composed = await RecordPreservationProposalValue.fromRequest(trusted)
  if (composed instanceof Error) throw composed
  expect(composed.props.digest.equals(original.props.digest)).toBe(true)
  expect(composed.matchesRequest(request)).toBe(true)
  expect(composed.matchesRequest({ ...request, reason: ` ${request.reason} ` })).toBe(true)
  expect(composed.matchesRequest({ ...request, reason: "Different purpose" })).toBe(false)
  expect(
    composed.matchesRequest({
      ...request,
      preservation: {
        ...request.preservation,
        kind: "retention",
        retainUntil: "2027-01-01T00:00:00Z",
      },
    }),
  ).toBe(false)
  expect(
    composed.matchesRequest({
      ...request,
      disclosure: {
        ...request.disclosure,
        grants: [
          {
            accountId: "97ba13d4-1f7c-4866-a108-1bbb5acccef8",
            actions: ["read"],
            purposes: ["review"],
            validFrom: input.finalizedAt,
            validUntil: null,
          },
        ],
      },
    }),
  ).toBe(false)
  expect(composed.matchesRequest({ ...request, actorAccountId: input.actorAccountId })).toBe(false)
  expect(composed.matchesRequest(null)).toBe(false)
  const replay = await RecordPreservationProposalValue.fromRequest(trusted)
  if (replay instanceof Error) throw replay
  expect(replay.props.canonical.toString()).toBe(composed.props.canonical.toString())
  for (const injected of [
    { actorAccountId: "b9a2c0c4-a088-4df7-8cf4-59447b86c1cf" },
    { source: { ...input.source, contentDigest: "c".repeat(64) } },
    { attachmentId: crypto.randomUUID() },
    { approved: true },
    { finalizedAt: input.finalizedAt },
    { disclosure: { ...request.disclosure, revision: 2 } },
  ])
    expect(
      await RecordPreservationProposalValue.fromRequest({
        ...trusted,
        request: { ...request, ...injected },
      }),
    ).toBeInstanceOf(Error)
  expect(
    await RecordPreservationProposalValue.fromRequest({
      ...trusted,
      sourceAuthorizationRef: { ...input.sourceAuthorizationRef, approved: true },
    }),
  ).toBeInstanceOf(Error)
})
