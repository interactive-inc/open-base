import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { PreservedRecordDisclosurePolicyRepository } from "@system/infrastructure/repositories/records/preserved-record-disclosure-policy.repository"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture() {
  const db = await createLocalD1Database({ schema: "" })
  for (const name of ["system-core", "system-record-preservation"]) {
    await execSql(
      db,
      readFileSync(new URL(`../infrastructure/schema/${name}.sql`, import.meta.url), "utf8"),
    )
  }
  await execSql(
    db,
    "CREATE TABLE test_authorization (allowed INTEGER NOT NULL); INSERT INTO test_authorization VALUES (1)",
  )
  const repository = new PreservedRecordDisclosurePolicyRepository({
    env: { DB: db },
    assertions: [
      db.prepare(
        "SELECT CASE WHEN (SELECT allowed FROM test_authorization) = 1 THEN 1 ELSE json_extract('', '$') END",
      ),
    ],
  })
  return { db, repository }
}

function publication(
  input: { id?: string; recordId?: string; revision?: number; status?: string } = {},
) {
  const entity = PreservedRecordDisclosurePolicyEntity.create({
    id: input.id ?? crypto.randomUUID(),
    revision: input.revision ?? 1,
    recordId: input.recordId ?? crypto.randomUUID(),
    status: input.status ?? "active",
    publishedAt: "2026-09-13T00:00:00Z",
    actorAccountId: "operator",
    reason: "Authorized disclosure",
    auditEventId: crypto.randomUUID(),
    grants: [
      {
        accountId: "eb2aaac2-352f-4196-8e01-adea61c54466",
        actions: ["read"],
        purposes: ["review"],
        validFrom: "2026-09-13T00:00:00.000Z",
        validUntil: "2026-09-13T01:00:00.000Z",
      },
    ],
  })
  if (entity instanceof Error) throw entity
  const audit = SystemAuditEventEntity.restore({
    eventId: entity.snapshot.auditEventId,
    actorAccountId: entity.snapshot.actorAccountId,
    action: "system.record.disclosure_policy.published",
    targetType: "system:record-disclosure-policy",
    targetId: entity.snapshot.id,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: JSON.stringify(entity.snapshot),
    metadataJson: null,
    occurredAtEpochMilliseconds: Date.parse(entity.snapshot.publishedAt),
  })
  if (audit instanceof Error) throw audit
  return { entity, audit }
}

test("publication composes atomically and reads the latest revoked revision", async () => {
  const f = await fixture()
  const first = publication()
  expect(first.entity.snapshot.publishedAt).toBe("2026-09-13T00:00:00.000Z")
  expect(await f.repository.findCurrent(first.entity.snapshot.id)).toBeNull()
  const statements = f.repository.preparePublish(first.entity, first.audit)
  expect(
    await f.db.batch([...statements, f.db.prepare("SELECT json_extract('', '$')")]).then(
      () => null,
      (cause: unknown) => cause,
    ),
  ).toBeInstanceOf(Error)
  expect(
    await f.db
      .prepare("SELECT count(*) AS count FROM system_audit_events")
      .first<Record<string, unknown>>(),
  ).toEqual({
    count: 0,
  })
  expect(await f.repository.findCurrent(first.entity.snapshot.id)).toBeNull()
  await f.db.batch([...statements])
  const next = publication({
    id: first.entity.snapshot.id,
    recordId: first.entity.snapshot.recordId,
    revision: 2,
    status: "revoked",
  })
  await f.db.batch([...f.repository.preparePublish(next.entity, next.audit)])
  const current = await f.repository.findCurrent(first.entity.snapshot.id)
  if (current instanceof Error || current === null) throw new Error("missing current policy")
  expect(current.snapshot).toEqual(next.entity.snapshot)
  expect(
    await f.db.batch([...statements]).then(
      () => null,
      (cause: unknown) => cause,
    ),
  ).toBeInstanceOf(Error)
  expect(
    await f.db
      .prepare("SELECT count(*) AS count FROM system_audit_events")
      .first<Record<string, unknown>>(),
  ).toEqual({
    count: 2,
  })
})

test("publication and reads reject authorization revoked after preparation", async () => {
  const f = await fixture()
  const first = publication()
  const statements = f.repository.preparePublish(first.entity, first.audit)
  await execSql(f.db, "UPDATE test_authorization SET allowed = 0")
  expect(
    await f.db.batch([...statements]).then(
      () => null,
      (cause: unknown) => cause,
    ),
  ).toBeInstanceOf(Error)
  expect(await f.repository.findCurrent(first.entity.snapshot.id)).toBeInstanceOf(Error)
  expect(
    await f.db
      .prepare("SELECT count(*) AS count FROM system_audit_events")
      .first<Record<string, unknown>>(),
  ).toEqual({
    count: 0,
  })
  expect(
    await f.db
      .prepare("SELECT count(*) AS count FROM system_record_disclosure_policies")
      .first<Record<string, unknown>>(),
  ).toEqual({ count: 0 })
})

test("disclosure guard rejects changed policy and authorization before audited disclosure", async () => {
  const f = await fixture()
  const first = publication()
  await f.db.batch([...f.repository.preparePublish(first.entity, first.audit)])
  const request = {
    recordId: first.entity.snapshot.recordId,
    accountId: "eb2aaac2-352f-4196-8e01-adea61c54466",
    action: "read",
    purpose: "review",
    at: new Date("2026-09-13T00:30:00Z"),
  }
  for (const denied of [
    { ...request, accountId: "operator" },
    { ...request, action: "export" },
    { ...request, purpose: "other" },
    { ...request, at: new Date("2026-09-13T01:00:00Z") },
  ])
    expect(f.repository.prepareDisclosureGuard(first.entity, denied)).toBeInstanceOf(Error)
  const guard = f.repository.prepareDisclosureGuard(first.entity, request)
  if (guard instanceof Error) throw guard
  await f.db.batch([...guard])
  await execSql(f.db, "UPDATE test_authorization SET allowed = 0")
  expect(await f.db.batch([...guard]).catch((cause: unknown) => cause)).toBeInstanceOf(Error)
  await execSql(f.db, "UPDATE test_authorization SET allowed = 1")
  const revoked = publication({
    id: first.entity.snapshot.id,
    recordId: first.entity.snapshot.recordId,
    revision: 2,
    status: "revoked",
  })
  await f.db.batch([...f.repository.preparePublish(revoked.entity, revoked.audit)])
  await execSql(f.db, "CREATE TABLE test_disclosure_audit (id INTEGER)")
  expect(
    await f.db
      .batch([f.db.prepare("INSERT INTO test_disclosure_audit VALUES (1)"), ...guard])
      .catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  expect(
    await f.db
      .prepare("SELECT count(*) AS count FROM test_disclosure_audit")
      .first<Record<string, unknown>>(),
  ).toEqual({
    count: 0,
  })
  expect(f.repository.prepareDisclosureGuard(revoked.entity, request)).toBeInstanceOf(Error)
})
