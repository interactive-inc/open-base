import { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import { RecordRetirementVerificationReceiptEntity } from "@system/domain/entities/record-retirement-verification-receipt.entity"
import { RecordCoveragePageEntity } from "@system/domain/entities/record-coverage-page.entity"

export async function createRetirementDecisionProposal() {
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
