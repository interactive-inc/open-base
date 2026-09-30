import { expect, test } from "bun:test"
import { RecordRetirementProposalValue } from "@system/domain/values/records/record-retirement-proposal.value"
import { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import { RecordRetirementVerificationReceiptEntity } from "@system/domain/entities/record-retirement-verification-receipt.entity"
import { RecordCoveragePageEntity } from "@system/domain/entities/record-coverage-page.entity"

async function fixture() {
  const freezeId = crypto.randomUUID()
  const scope = {
    freezeId,
    sourceNamespace: "example-source",
    ownerContext: "example",
    purpose: "archive",
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
  }
  const pages = []
  for (const recordKind of ["record", "attachment"]) {
    const page = await RecordCoveragePageEntity.create(
      {
        ...scope,
        id: crypto.randomUUID(),
        recordKind,
        sequence: 1,
        previousDigest: null,
        afterCursor: null,
        nextCursor: null,
        checkedAt: "2026-09-14T00:00:00.000Z",
        records: [],
      },
      null,
    )
    if (page instanceof Error) throw page
    pages.push(page)
  }
  const plan = await RecordRetirementVerificationPlanEntity.create({
    ...scope,
    id: crypto.randomUUID(),
    createdAt: "2026-09-14T00:00:01.000Z",
    auditEventId: crypto.randomUUID(),
    capability: { revision: 1, recordKinds: ["record", "attachment"] },
    coverage: pages.map((page) => ({
      recordKind: page.snapshot.recordKind,
      terminalPageId: page.snapshot.id,
      terminalDigest: page.digest,
      pageCount: 1,
      recordCount: 0,
    })),
  })
  if (plan instanceof Error) throw plan
  const receipts: RecordRetirementVerificationReceiptEntity[] = []
  for (const page of pages) {
    const previous = receipts.at(-1) ?? null
    const receipt = await RecordRetirementVerificationReceiptEntity.create(
      {
        id: crypto.randomUUID(),
        planId: plan.snapshot.id,
        planDigest: plan.digest,
        ordinal: receipts.length + 1,
        coveragePageId: page.snapshot.id,
        coveragePageDigest: page.digest,
        previousReceiptDigest: previous?.digest ?? null,
        storageKeys: [],
        actorAccountId: scope.actorAccountId,
        checkedAt: "2026-09-14T00:00:02.000Z",
        auditEventId: crypto.randomUUID(),
      },
      { plan, page, previous },
    )
    if (receipt instanceof Error) throw receipt
    receipts.push(receipt)
  }
  const first = receipts[0]
  const terminalReceipt = receipts[1]
  if (first === undefined || terminalReceipt === undefined)
    throw new Error("terminal receipt missing")
  return {
    plan,
    first,
    terminalReceipt,
    actorAccountId: "00e1a673-4bef-44f9-b57b-db0468faceed",
    reason: "Retire source and retain records",
  }
}

test("retirement approval binds the complete plan and terminal verification independently of preservation", async () => {
  const input = await fixture()
  const proposal = await RecordRetirementProposalValue.create(input)
  if (proposal instanceof Error) throw proposal
  expect(proposal.toReview()).toEqual(JSON.parse(proposal.props.canonical.toString()))
  const restored = await RecordRetirementProposalValue.restore(
    JSON.parse(proposal.props.canonical.toString()),
  )
  if (restored instanceof Error) throw restored
  expect(restored.props.digest.toString()).toBe(proposal.props.digest.toString())
  for (const change of [
    { reason: "Different reason" },
    { actorAccountId: "f7dec41b-fe84-4dda-9212-0be0001c1dd1" },
  ]) {
    const changed = await RecordRetirementProposalValue.create({ ...input, ...change })
    if (changed instanceof Error) throw changed
    expect(changed.props.digest.toString()).not.toBe(proposal.props.digest.toString())
  }
  const body = {
    version: 1,
    operation: "system.record.retire",
    actorAccountId: input.actorAccountId,
    reason: input.reason,
    plan: input.plan.snapshot,
    planDigest: input.plan.digest,
    terminalReceipt: input.terminalReceipt.snapshot,
    terminalReceiptDigest: input.terminalReceipt.digest,
  }
  for (const changed of [
    { ...body, operation: "system.record.preserve" },
    { ...body, plan: { ...body.plan, sourceNamespace: "another-source" } },
    { ...body, plan: { ...body.plan, freezeId: crypto.randomUUID() } },
    { ...body, plan: { ...body.plan, coverage: body.plan.coverage.slice(1) } },
    { ...body, terminalReceipt: { ...body.terminalReceipt, id: crypto.randomUUID() } },
    { ...body, terminalReceiptDigest: "0".repeat(64) },
    { ...body, reason: " " },
    { ...body, approved: true },
  ])
    expect(await RecordRetirementProposalValue.restore(changed)).toBeInstanceOf(Error)
  expect(
    await RecordRetirementProposalValue.create({ ...input, terminalReceipt: input.first }),
  ).toBeInstanceOf(Error)
  const other = await fixture()
  expect(
    await RecordRetirementProposalValue.create({
      ...input,
      terminalReceipt: other.terminalReceipt,
    }),
  ).toBeInstanceOf(Error)
})
