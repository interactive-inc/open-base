import { testAccountId, testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { expect, test } from "bun:test"
import { PreservedRecordExecutionProofValue } from "@system/domain/values/records/preserved-record-execution-proof.value"
import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import { SystemCaseEntity } from "@system/domain/entities/system-case.entity"
import { ProposalEntity } from "@system/domain/entities/proposal.entity"
import { createProposalId } from "@system/domain/schemas/workflow/proposal-id.schema"
import { systemCaseIdSchema } from "@system/domain/schemas/workflow/system-case.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

const capturedAt = "2026-09-13T00:00:00.000Z"
const proposedAt = new Date("2026-09-13T00:00:01.000Z")
const grantedAt = new Date("2026-09-13T00:00:02.000Z")
const finalizedAt = "2026-09-13T00:00:03.000Z"

async function fixture(
  options: {
    authorization?: Record<string, unknown>
    workflowCase?: Partial<Parameters<typeof SystemCaseEntity.create>[0]>
  } = {},
) {
  const record = PreservedRecordEntity.create({
    id: crypto.randomUUID(),
    attachmentId: crypto.randomUUID(),
    attachmentDigest: "b".repeat(64),
    preservationId: crypto.randomUUID(),
    disclosurePolicyId: crypto.randomUUID(),
    disclosurePolicyRevision: 1,
    source: {
      sourceNamespace: "sample-source",
      ownerContext: "sample-records",
      recordKind: "record",
      recordId: "original-1",
      formatId: "sample-format",
      formatVersion: 1,
      sourceRevision: null,
      sourceRecordedAt: null,
      capturedAt,
      contentDigest: "a".repeat(64),
    },
    sourceAuthorizationRef: {
      context: "sample-records",
      kind: "export-grant",
      id: "grant-1",
      version: "1",
    },
    actorAccountId: testAccountId("operator"),
    finalizedAt,
    reason: "Preserve confirmed source",
    auditEventId: crypto.randomUUID(),
  })
  if (record instanceof Error) throw record
  const initialDisclosure = PreservedRecordDisclosurePolicyEntity.create({
    id: record.snapshot.disclosurePolicyId,
    revision: 1,
    recordId: record.snapshot.id,
    status: "active",
    publishedAt: finalizedAt,
    actorAccountId: testAccountId("operator"),
    reason: "Archive access",
    auditEventId: crypto.randomUUID(),
    grants: [],
  })
  const initialPreservation = AttachmentPreservationEntity.create({
    id: record.snapshot.preservationId,
    attachmentId: record.snapshot.attachmentId,
    sha256: record.snapshot.attachmentDigest,
    kind: "hold",
    retainUntil: null,
    reason: record.snapshot.reason,
    actorAccountId: testAccountId("operator"),
    createdAt: finalizedAt,
    auditEventId: crypto.randomUUID(),
    revision: 1,
    release: null,
  })
  if (initialDisclosure instanceof Error || initialPreservation instanceof Error)
    throw new Error("invalid fixture")
  const intent = await RecordPreservationProposalValue.create({
    record,
    disclosure: initialDisclosure,
    preservation: initialPreservation,
  })
  if (intent instanceof Error) throw intent
  const proposal = await ProposalEntity.create({
    id: createProposalId(),
    seriesId: testLiteralId("series-1"),
    version: 1,
    procedureKey: "record-preservation",
    procedureRevision: 1,
    body: JSON.parse(intent.props.canonical.toString()),
    createdByAccountId: zAccountId.parse(testAccountId("operator")),
    supersedesProposalId: null,
    createdAt: proposedAt,
  })
  if (proposal instanceof Error) throw proposal
  const workflowCase = SystemCaseEntity.create({
    id: systemCaseIdSchema.parse(testLiteralId("case-1")),
    subject: {
      context: "system",
      kind: "record-preservation",
      id: record.snapshot.id,
      version: "1",
    },
    proposalDigest: proposal.digest,
    createdByAccountId: zAccountId.parse(testAccountId("operator")),
    status: "executed",
    createdAt: proposedAt,
    updatedAt: new Date(finalizedAt),
    ...options.workflowCase,
  })
  const authorization = ExecutionAuthorizationEntity.create({
    id: testLiteralId("authorization-1"),
    caseId: testLiteralId("case-1"),
    operationKey: "system.record.preserve",
    proposalDigest: proposal.digest,
    grantedToAccountId: testAccountId("operator"),
    grantedAt,
    expiresAt: new Date("2026-09-13T00:01:00.000Z"),
    usedAt: new Date(finalizedAt),
    ...options.authorization,
  })
  if (workflowCase instanceof Error || authorization instanceof Error)
    throw new Error("invalid workflow fixture")
  return { record, initialDisclosure, initialPreservation, proposal, workflowCase, authorization }
}

test("原記録の版を補わず、実際に使用した許可と確定した提案を結び付ける", async () => {
  const f = await fixture()
  const proof = await PreservedRecordExecutionProofValue.create(f)
  if (proof instanceof Error) throw proof
  expect(proof.props).toMatchObject({
    recordId: f.record.snapshot.id,
    caseId: testLiteralId("case-1"),
    proposalId: f.proposal.id,
    authorizationId: testLiteralId("authorization-1"),
    executedAt: finalizedAt,
  })
  expect(f.record.source.props.sourceRevision).toBeNull()
  expect(f.record.source.props.sourceRecordedAt).toBeNull()
})

test.each([
  { usedAt: null },
  { caseId: testLiteralId("another-case") },
  { grantedToAccountId: testAccountId("another-operator") },
  { operationKey: "another.operation" },
  { proposalDigest: "c".repeat(64) },
  { usedAt: new Date("2026-09-13T00:00:02.500Z") },
])("IDや実行時点や内容の違う実行許可を混ぜない: %j", async (authorization) => {
  expect(
    await PreservedRecordExecutionProofValue.create(await fixture({ authorization })),
  ).toBeInstanceOf(Error)
})

test("未実行の案件や別の対象版を確定根拠にしない", async () => {
  for (const status of ["pending", "approved", "cancelled"] as const) {
    expect(
      await PreservedRecordExecutionProofValue.create(await fixture({ workflowCase: { status } })),
    ).toBeInstanceOf(Error)
  }
  const f = await fixture()
  for (const subject of [
    { ...f.workflowCase.subject, id: crypto.randomUUID() },
    { ...f.workflowCase.subject, context: "sample-records" },
    { ...f.workflowCase.subject, kind: "another-kind" },
    { ...f.workflowCase.subject, version: "2" },
  ]) {
    const changed = SystemCaseEntity.create({
      id: f.workflowCase.id,
      subject,
      proposalDigest: f.proposal.digest,
      createdByAccountId: f.workflowCase.createdByAccountId,
      status: "executed",
      createdAt: proposedAt,
      updatedAt: new Date(finalizedAt),
    })
    if (changed instanceof Error) throw changed
    expect(
      await PreservedRecordExecutionProofValue.create({ ...f, workflowCase: changed }),
    ).toBeInstanceOf(Error)
  }
})

test("元IDが同じでも原文digestと当初の保持・開示条件を差し替えない", async () => {
  const f = await fixture()
  const changedRecord = PreservedRecordEntity.create({
    ...f.record.snapshot,
    source: { ...f.record.source.props, contentDigest: "c".repeat(64) },
  })
  const changedPolicy = PreservedRecordDisclosurePolicyEntity.create({
    ...f.initialDisclosure.snapshot,
    reason: "Changed disclosure",
  })
  const changedPreservation = AttachmentPreservationEntity.create({
    ...f.initialPreservation.snapshot,
    reason: "Changed retention",
  })
  if (
    changedRecord instanceof Error ||
    changedPolicy instanceof Error ||
    changedPreservation instanceof Error
  )
    throw new Error("invalid changed fixture")
  for (const changed of [
    { record: changedRecord },
    { initialDisclosure: changedPolicy },
    { initialPreservation: changedPreservation },
  ]) {
    expect(await PreservedRecordExecutionProofValue.create({ ...f, ...changed })).toBeInstanceOf(
      Error,
    )
  }
})

test("保全後に解除された保持条件や後続の開示版を当初の確定根拠にしない", async () => {
  const f = await fixture()
  const released = f.initialPreservation.release({
    operationId: crypto.randomUUID(),
    at: "2026-09-13T00:01:00.000Z",
    actorAccountId: testAccountId("operator"),
    reason: "Release after review",
    auditEventId: crypto.randomUUID(),
  })
  const revised = PreservedRecordDisclosurePolicyEntity.create({
    ...f.initialDisclosure.snapshot,
    revision: 2,
    publishedAt: "2026-09-13T00:01:00.000Z",
    auditEventId: crypto.randomUUID(),
  })
  if (released instanceof Error || revised instanceof Error)
    throw new Error("invalid later snapshots")
  expect(
    await PreservedRecordExecutionProofValue.create({ ...f, initialPreservation: released }),
  ).toBeInstanceOf(Error)
  expect(
    await PreservedRecordExecutionProofValue.create({ ...f, initialDisclosure: revised }),
  ).toBeInstanceOf(Error)
  expect(await PreservedRecordExecutionProofValue.create(f)).not.toBeInstanceOf(Error)
})

test("提案・案件・許可・実行の時系列が逆転した根拠を拒否する", async () => {
  for (const workflowCase of [
    { createdAt: new Date("2026-09-13T00:00:00.500Z") },
    { createdAt: new Date("2026-09-13T00:00:02.500Z") },
    { updatedAt: new Date("2026-09-13T00:00:02.500Z") },
  ]) {
    expect(
      await PreservedRecordExecutionProofValue.create(await fixture({ workflowCase })),
    ).toBeInstanceOf(Error)
  }
})
