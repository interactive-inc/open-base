import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { readFileSync } from "node:fs"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { RecordSourceFreezeEntity } from "@system/domain/entities/record-source-freeze.entity"
import { RecordCoveragePageEntity } from "@system/domain/entities/record-coverage-page.entity"
import { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"
import { RecordCoveragePageRepository } from "@system/infrastructure/repositories/records/record-coverage-page.repository"
import { RecordRetirementVerificationPlanRepository } from "@system/infrastructure/repositories/records/record-retirement-verification-plan.repository"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("検査計画は監査と原子的に保存され、再開・上書き拒否・停止解除を検査する", async () => {
  const db = await createSystemAttachmentTestDatabase()
  for (const name of [
    "system-record-preservation",
    "system-record-source-freeze",
    "system-record-coverage",
    "system-record-retirement",
  ])
    await execSql(
      db,
      readFileSync(new URL(`../infrastructure/schema/${name}.sql`, import.meta.url), "utf8"),
    )
  const context = { env: { DB: db }, assertions: [db.prepare("SELECT 1")] }
  const freeze = RecordSourceFreezeEntity.create({
    id: crypto.randomUUID(),
    sourceNamespace: "example-source",
    ownerContext: "example",
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Archive",
    createdAt: "2026-09-14T00:00:00.000Z",
    auditEventId: crypto.randomUUID(),
    revision: 1,
    release: null,
  })
  if (freeze instanceof Error) throw freeze
  const freezeAudit = freeze.audit(null)
  if (freezeAudit instanceof Error) throw freezeAudit
  const freezes = new RecordSourceFreezeRepository(context)
  expect(await freezes.write(freeze, freezeAudit)).toBe("written")
  const page = await RecordCoveragePageEntity.create(
    {
      id: crypto.randomUUID(),
      freezeId: freeze.snapshot.id,
      sourceNamespace: "example-source",
      ownerContext: "example",
      recordKind: "record",
      sequence: 1,
      previousDigest: null,
      afterCursor: null,
      nextCursor: null,
      purpose: "archive",
      checkedAt: "2026-09-14T00:00:01.000Z",
      actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
      records: [],
    },
    null,
  )
  if (page instanceof Error) throw page
  const pageAudit = SystemAuditEventEntity.restore({
    eventId: crypto.randomUUID(),
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    action: "system.record.coverage.page.verified",
    targetType: "system:record-coverage-page",
    targetId: page.snapshot.id,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: JSON.stringify(page.snapshot),
    metadataJson: null,
    occurredAtEpochMilliseconds: Date.parse(page.snapshot.checkedAt),
  })
  if (pageAudit instanceof Error) throw pageAudit
  expect(await new RecordCoveragePageRepository(context).append(page, pageAudit)).toBe("written")
  const plan = await RecordRetirementVerificationPlanEntity.create({
    id: crypto.randomUUID(),
    freezeId: freeze.snapshot.id,
    sourceNamespace: "example-source",
    ownerContext: "example",
    purpose: "archive",
    capability: { revision: 1, recordKinds: ["record"] },
    coverage: [
      {
        recordKind: "record",
        terminalPageId: page.snapshot.id,
        terminalDigest: page.digest,
        pageCount: 1,
        recordCount: 0,
      },
    ],
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    createdAt: "2026-09-14T00:00:02.000Z",
    auditEventId: crypto.randomUUID(),
  })
  if (plan instanceof Error) throw plan
  const repository = new RecordRetirementVerificationPlanRepository(context)
  for (const changes of [
    { sourceNamespace: "different-source" },
    { purpose: "different" },
    { coverage: plan.snapshot.coverage.map((coverage) => ({ ...coverage, recordCount: 1 })) },
    {
      coverage: plan.snapshot.coverage.map((coverage) => ({
        ...coverage,
        terminalDigest: "a".repeat(64),
      })),
    },
  ]) {
    const invalid = await RecordRetirementVerificationPlanEntity.create({
      ...plan.snapshot,
      ...changes,
    })
    if (invalid instanceof Error) throw invalid
    expect(await repository.append(invalid)).toBeInstanceOf(Error)
    expect(
      z
        .number()
        .parse(
          await db
            .prepare("SELECT count(*) AS count FROM system_audit_events WHERE event_id=?1")
            .bind(invalid.snapshot.auditEventId)
            .first("count"),
        ),
    ).toBe(0)
  }
  const lateGuard = db
    .prepare(`SELECT CASE WHEN EXISTS (
    SELECT 1 FROM system_record_retirement_plans WHERE id=?1
  ) THEN json_extract('{}','retirement_authorization_changed') ELSE 1 END`)
    .bind(plan.snapshot.id)
  const denied = new RecordRetirementVerificationPlanRepository({
    ...context,
    assertions: [lateGuard],
  })
  expect(await denied.append(plan)).toBeInstanceOf(Error)
  expect(await repository.find(plan.snapshot.id)).toBeNull()
  expect(
    z
      .number()
      .parse(
        await db
          .prepare("SELECT count(*) AS count FROM system_audit_events WHERE event_id=?1")
          .bind(plan.snapshot.auditEventId)
          .first("count"),
      ),
  ).toBe(0)
  expect(await repository.append(plan)).toBe("written")
  const restored = await new RecordRetirementVerificationPlanRepository(context).find(
    plan.snapshot.id,
  )
  if (restored instanceof Error || restored === null)
    throw new Error("plan not restored", { cause: restored })
  expect(restored.target(1)).toEqual(plan.target(1))
  const duplicate = await RecordRetirementVerificationPlanEntity.create({
    ...plan.snapshot,
    auditEventId: crypto.randomUUID(),
  })
  if (duplicate instanceof Error) throw duplicate
  expect(await repository.append(duplicate)).toBe("conflict")
  expect(
    z
      .number()
      .parse(
        await db
          .prepare("SELECT count(*) AS count FROM system_audit_events WHERE event_id=?1")
          .bind(duplicate.snapshot.auditEventId)
          .first("count"),
      ),
  ).toBe(0)
  for (const sql of [
    "UPDATE system_record_retirement_plans SET digest='changed'",
    "DELETE FROM system_record_retirement_plans",
    "INSERT OR REPLACE INTO system_record_retirement_plans SELECT * FROM system_record_retirement_plans",
  ])
    expect(
      await db
        .prepare(sql)
        .run()
        .then(
          () => null,
          (cause: unknown) => cause,
        ),
    ).toBeInstanceOf(Error)
  const released = freeze.release({
    at: "2026-09-14T00:00:03.000Z",
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Resume",
    auditEventId: crypto.randomUUID(),
  })
  if (released instanceof Error) throw released
  const releaseAudit = released.audit(freeze)
  if (releaseAudit instanceof Error) throw releaseAudit
  expect(await freezes.write(released, releaseAudit, freeze)).toBe("written")
  const stale = await RecordRetirementVerificationPlanEntity.create({
    ...plan.snapshot,
    id: crypto.randomUUID(),
    auditEventId: crypto.randomUUID(),
    createdAt: "2026-09-14T00:00:04.000Z",
  })
  if (stale instanceof Error) throw stale
  expect(await repository.append(stale)).toBeInstanceOf(Error)
  expect(await repository.find(stale.snapshot.id)).toBeNull()
  expect(
    await new RecordRetirementVerificationPlanRepository({ ...context, assertions: [] }).find(
      plan.snapshot.id,
    ),
  ).toBeInstanceOf(Error)
})
