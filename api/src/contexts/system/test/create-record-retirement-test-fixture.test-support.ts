import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { readFileSync } from "node:fs"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { RecordSourceFreezeEntity } from "@system/domain/entities/record-source-freeze.entity"
import { RecordCoveragePageEntity } from "@system/domain/entities/record-coverage-page.entity"
import { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"
import { RecordCoveragePageRepository } from "@system/infrastructure/repositories/records/record-coverage-page.repository"
import { RecordRetirementVerificationPlanRepository } from "@system/infrastructure/repositories/records/record-retirement-verification-plan.repository"

/** 二種別の空の照合終端を保存し、Systemだけで検査計画を検証する。 */
export async function createRecordRetirementTestFixture() {
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
  const frozen = await new RecordSourceFreezeRepository(context).write(freeze, freezeAudit)
  if (frozen !== "written") throw new Error("fixture freeze failed", { cause: frozen })
  const pages = []
  for (const recordKind of ["record", "attachment"]) {
    const page = await RecordCoveragePageEntity.create(
      {
        id: crypto.randomUUID(),
        freezeId: freeze.snapshot.id,
        sourceNamespace: "example-source",
        ownerContext: "example",
        recordKind,
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
    const audit = SystemAuditEventEntity.restore({
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
    if (audit instanceof Error) throw audit
    const saved = await new RecordCoveragePageRepository(context).append(page, audit)
    if (saved !== "written") throw new Error("fixture coverage failed", { cause: saved })
    pages.push(page)
  }
  const plan = await RecordRetirementVerificationPlanEntity.create({
    id: crypto.randomUUID(),
    freezeId: freeze.snapshot.id,
    sourceNamespace: "example-source",
    ownerContext: "example",
    purpose: "archive",
    capability: { revision: 1, recordKinds: ["record", "attachment"] },
    coverage: pages.map((page) => ({
      recordKind: page.snapshot.recordKind,
      terminalPageId: page.snapshot.id,
      terminalDigest: page.digest,
      pageCount: 1,
      recordCount: 0,
    })),
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    createdAt: "2026-09-14T00:00:02.000Z",
    auditEventId: crypto.randomUUID(),
  })
  if (plan instanceof Error) throw plan
  const planned = await new RecordRetirementVerificationPlanRepository(context).append(plan)
  if (planned !== "written") throw new Error("fixture plan failed", { cause: planned })
  return { db, context, freeze, plan, pages }
}
