import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"

function fixture() {
  const db = new Database(":memory:")
  db.exec("PRAGMA foreign_keys = ON")
  for (const name of ["system-core", "system-record-preservation"]) {
    db.exec(readFileSync(new URL(`../infrastructure/schema/${name}.sql`, import.meta.url), "utf8"))
  }
  return db
}

function publish(
  db: Database,
  input: {
    revision?: number
    status?: string | null
    recordId?: string
    publishedAt?: string
    auditActor?: string
    auditBody?: string
  } = {},
) {
  const snapshot = {
    id: "policy",
    revision: input.revision ?? 1,
    recordId: input.recordId ?? "record",
    status: input.status === undefined ? "active" : input.status,
    publishedAt: input.publishedAt ?? "2026-09-13T00:00:00.000Z",
    actorAccountId: "actor",
    reason: "Preserve original evidence",
    auditEventId: crypto.randomUUID(),
    grants: [],
  }
  const json = JSON.stringify(snapshot)
  db.transaction(() => {
    db.query(
      "INSERT INTO system_audit_events (event_id, actor_account_id, action, target_type, target_id, outcome, after_json, occurred_at) VALUES (?, ?, 'system.record.disclosure_policy.published', 'system:record-disclosure-policy', ?, 'succeeded', ?, ?)",
    ).run(
      snapshot.auditEventId,
      input.auditActor ?? snapshot.actorAccountId,
      snapshot.id,
      input.auditBody ?? json,
      Date.parse(snapshot.publishedAt),
    )
    db.query(
      "INSERT INTO system_record_disclosure_policies (revision_id, id, revision, record_id, audit_event_id, snapshot_json) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      crypto.randomUUID(),
      snapshot.id,
      snapshot.revision,
      snapshot.recordId,
      snapshot.auditEventId,
      json,
    )
  })()
}

test("disclosure schema rejects null status even with matching audit", () => {
  const db = fixture()
  try {
    expect(() => publish(db, { status: null })).toThrow()
    expect(db.query("SELECT count(*) AS count FROM system_audit_events").get()).toEqual({
      count: 0,
    })
  } finally {
    db.close()
  }
})

test("disclosure publication requires sequential immutable history and matching audit", () => {
  const db = fixture()
  try {
    publish(db)
    for (const input of [
      { revision: 1 },
      { revision: 3 },
      { revision: 2, recordId: "other" },
      { revision: 2, publishedAt: "2026-09-12T00:00:00.000Z" },
      { revision: 2, auditActor: "other" },
      { revision: 2, auditBody: "{}" },
    ])
      expect(() => publish(db, input)).toThrow()
    expect(db.query("SELECT count(*) AS count FROM system_audit_events").get()).toEqual({
      count: 1,
    })
    publish(db, { revision: 2, status: "revoked" })
    expect(() =>
      db.exec("UPDATE system_record_disclosure_policies SET record_id = 'other'"),
    ).toThrow()
    expect(() => db.exec("DELETE FROM system_record_disclosure_policies")).toThrow()
    expect(
      db.query("SELECT count(*) AS count FROM system_record_disclosure_policies").get(),
    ).toEqual({ count: 2 })
  } finally {
    db.close()
  }
})
