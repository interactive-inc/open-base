import { PrepareRecordRetirementRetentionAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-retention.adapter"
import { PrepareRecordRetirementCoverageAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-coverage.adapter"
import { expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { createRecordRetirementTestFixture } from "@system/test/create-record-retirement-test-fixture.test-support"
import { RecordRetirementVerificationReceiptEntity } from "@system/domain/entities/record-retirement-verification-receipt.entity"
import { RecordRetirementVerificationReceiptRepository } from "@system/infrastructure/repositories/records/record-retirement-verification-receipt.repository"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("検査順序をDBで固定し、飛越し・別ページ・再送競合・途中失敗による監査だけの残存を拒否する", async () => {
  const f = await createRecordRetirementTestFixture()
  const completeness = new PrepareRecordRetirementCoverageAdapter(f.context)
  const coverageInput = { planId: f.plan.snapshot.id, planDigest: f.plan.digest }
  expect(await completeness.prepare(coverageInput)).toBeInstanceOf(Error)
  const repository = new RecordRetirementVerificationReceiptRepository(f.context)
  const page1 = f.pages[0]
  const page2 = f.pages[1]
  if (page1 === undefined || page2 === undefined) throw new Error("fixture pages missing")
  const firstInput = {
    id: crypto.randomUUID(),
    planId: f.plan.snapshot.id,
    planDigest: f.plan.digest,
    ordinal: 1,
    coveragePageId: page1.snapshot.id,
    coveragePageDigest: page1.digest,
    previousReceiptDigest: null,
    storageKeys: [],
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    checkedAt: "2026-09-14T00:00:03.000Z",
    auditEventId: crypto.randomUUID(),
  }
  const first = await RecordRetirementVerificationReceiptEntity.create(firstInput, {
    plan: f.plan,
    page: page1,
    previous: null,
  })
  if (first instanceof Error) throw first
  const secondInput = {
    ...firstInput,
    id: crypto.randomUUID(),
    ordinal: 2,
    coveragePageId: page2.snapshot.id,
    coveragePageDigest: page2.digest,
    previousReceiptDigest: first.digest,
    checkedAt: "2026-09-14T00:00:04.000Z",
    auditEventId: crypto.randomUUID(),
  }
  const second = await RecordRetirementVerificationReceiptEntity.create(secondInput, {
    plan: f.plan,
    page: page2,
    previous: first,
  })
  if (second instanceof Error) throw second
  for (const storageKeys of [
    undefined,
    [
      { version: 1, digest: "a".repeat(64) },
      { version: 1, digest: "a".repeat(64) },
    ],
    [
      { version: 2, digest: "a".repeat(64) },
      { version: 1, digest: "a".repeat(64) },
    ],
  ])
    expect(
      await RecordRetirementVerificationReceiptEntity.create(
        { ...firstInput, storageKeys },
        { plan: f.plan, page: page1, previous: null },
      ),
    ).toBeInstanceOf(Error)
  const extraKey = await RecordRetirementVerificationReceiptEntity.create(
    { ...firstInput, storageKeys: [{ version: 1, digest: "a".repeat(64) }] },
    { plan: f.plan, page: page1, previous: null },
  )
  if (extraKey instanceof Error) throw extraKey
  expect(await repository.append(extraKey)).toBeInstanceOf(Error)
  expect(await repository.append(second)).toBeInstanceOf(Error)
  expect(await repository.findLatest(f.plan.snapshot.id)).toBeNull()
  expect(
    z
      .number()
      .parse(
        await f.db
          .prepare("SELECT count(*) FROM system_audit_events WHERE event_id=?1")
          .bind(second.snapshot.auditEventId)
          .first("count(*)"),
      ),
  ).toBe(0)
  for (const changed of [
    { ...firstInput, coveragePageId: page2.snapshot.id, coveragePageDigest: page2.digest },
    { ...firstInput, planDigest: "f".repeat(64) },
    { ...firstInput, checkedAt: "2026-09-14T00:00:01.000Z" },
  ]) {
    expect(
      await RecordRetirementVerificationReceiptEntity.create(changed, {
        plan: f.plan,
        page: page1,
        previous: null,
      }),
    ).toBeInstanceOf(Error)
    const canonical = CanonicalSystemJsonValue.create(changed)
    if (canonical instanceof Error) throw canonical
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) throw digest
    const restored = await RecordRetirementVerificationReceiptEntity.restore(
      changed,
      digest.toString(),
    )
    if (restored instanceof Error) throw restored
    const rejected = await repository.append(restored)
    expect(rejected).toBeInstanceOf(Error)
    if (!(rejected instanceof Error) || !(rejected.cause instanceof Error))
      throw new Error("missing rejection cause")
    expect(rejected.cause.message).toContain("record_retirement_receipt_plan_invalid")
  }
  const guarded = new RecordRetirementVerificationReceiptRepository({
    ...f.context,
    assertions: [
      f.db
        .prepare(`SELECT CASE WHEN EXISTS (SELECT 1 FROM system_record_retirement_receipts WHERE plan_id=?1)
      THEN json_extract('{}','retirement_permission_changed') ELSE 1 END`)
        .bind(f.plan.snapshot.id),
    ],
  })
  expect(await guarded.append(first)).toBeInstanceOf(Error)
  expect(await repository.findLatest(f.plan.snapshot.id)).toBeNull()
  expect(
    z
      .number()
      .parse(
        await f.db
          .prepare("SELECT count(*) FROM system_audit_events WHERE event_id=?1")
          .bind(first.snapshot.auditEventId)
          .first("count(*)"),
      ),
  ).toBe(0)
  const rival = await RecordRetirementVerificationReceiptEntity.create(
    { ...firstInput, id: crypto.randomUUID(), auditEventId: crypto.randomUUID() },
    { plan: f.plan, page: page1, previous: null },
  )
  if (rival instanceof Error) throw rival
  expect(await repository.append(first)).toBe("written")
  expect(await repository.append(rival)).toBe("conflict")
  expect(
    z
      .number()
      .parse(
        await f.db
          .prepare("SELECT count(*) FROM system_audit_events WHERE event_id=?1")
          .bind(rival.snapshot.auditEventId)
          .first("count(*)"),
      ),
  ).toBe(0)
  const resumed = await new RecordRetirementVerificationReceiptRepository(f.context).findLatest(
    f.plan.snapshot.id,
  )
  if (resumed instanceof Error || resumed === null)
    throw new Error("receipt not resumed", { cause: resumed })
  expect(resumed.digest).toBe(first.digest)
  expect(await completeness.prepare(coverageInput)).toBeInstanceOf(Error)
  expect(await repository.append(second)).toBe("written")
  const coverage = await completeness.prepare(coverageInput)
  if (coverage instanceof Error) throw coverage
  expect(coverage.totalPages).toBe(2)
  expect(coverage.terminalReceiptId).toBe(second.snapshot.id)
  expect(coverage.terminalReceiptDigest).toBe(second.digest)
  expect(coverage.assertions).toHaveLength(3)
  const retention = new PrepareRecordRetirementRetentionAdapter(f.context)
  expect(await retention.prepare(coverageInput, new Date())).not.toBeInstanceOf(Error)
  expect(await retention.prepare(coverageInput, new Date("invalid"))).toBeInstanceOf(Error)
  expect(
    await completeness.prepare({ ...coverageInput, planDigest: "0".repeat(64) }),
  ).toBeInstanceOf(Error)
  const terminal = await repository.findLatest(f.plan.snapshot.id)
  if (terminal instanceof Error || terminal === null)
    throw new Error("terminal missing", { cause: terminal })
  expect(terminal.snapshot.ordinal).toBe(f.plan.totalPages)
  expect(terminal.snapshot.previousReceiptDigest).toBe(first.digest)
  expect(
    await RecordRetirementVerificationReceiptEntity.restore(
      { ...first.snapshot, actorAccountId: "774e21f0-a9f3-46ff-a028-aa4a77248853" },
      first.digest,
    ),
  ).toBeInstanceOf(Error)
  for (const sql of [
    "DELETE FROM system_record_retirement_receipts",
    "UPDATE system_record_retirement_receipts SET ordinal=9",
    "INSERT OR REPLACE INTO system_record_retirement_receipts SELECT * FROM system_record_retirement_receipts",
  ])
    expect(
      await f.db
        .prepare(sql)
        .run()
        .then(
          () => null,
          (cause: unknown) => cause,
        ),
    ).toBeInstanceOf(Error)
  const release = f.freeze.release({
    at: "2026-09-14T00:00:05.000Z",
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Resume",
    auditEventId: crypto.randomUUID(),
  })
  if (release instanceof Error) throw release
  const releaseAudit = release.audit(f.freeze)
  if (releaseAudit instanceof Error) throw releaseAudit
  expect(
    await new RecordSourceFreezeRepository(f.context).write(release, releaseAudit, f.freeze),
  ).toBe("written")
  expect(await completeness.prepare(coverageInput)).toBeInstanceOf(Error)
  expect(
    await f.db.batch([...coverage.assertions]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
})

test("停止解除後は検査結果を追加できず、過去の検査結果だけを再開根拠にしない", async () => {
  const f = await createRecordRetirementTestFixture()
  const page = f.pages[0]
  if (page === undefined) throw new Error("fixture page missing")
  const receipt = await RecordRetirementVerificationReceiptEntity.create(
    {
      id: crypto.randomUUID(),
      planId: f.plan.snapshot.id,
      planDigest: f.plan.digest,
      ordinal: 1,
      coveragePageId: page.snapshot.id,
      coveragePageDigest: page.digest,
      previousReceiptDigest: null,
      storageKeys: [],
      actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
      checkedAt: "2026-09-14T00:00:04.000Z",
      auditEventId: crypto.randomUUID(),
    },
    { plan: f.plan, page, previous: null },
  )
  if (receipt instanceof Error) throw receipt
  const released = f.freeze.release({
    at: "2026-09-14T00:00:03.000Z",
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Resume",
    auditEventId: crypto.randomUUID(),
  })
  if (released instanceof Error) throw released
  const audit = released.audit(f.freeze)
  if (audit instanceof Error) throw audit
  expect(await new RecordSourceFreezeRepository(f.context).write(released, audit, f.freeze)).toBe(
    "written",
  )
  const repository = new RecordRetirementVerificationReceiptRepository(f.context)
  expect(await repository.append(receipt)).toBeInstanceOf(Error)
  expect(await repository.findLatest(f.plan.snapshot.id)).toBeNull()
  const unguarded = new RecordRetirementVerificationReceiptRepository({
    ...f.context,
    assertions: [],
  })
  expect(await unguarded.append(receipt)).toBeInstanceOf(Error)
  expect(await unguarded.find(receipt.snapshot.id)).toBeInstanceOf(Error)
})
