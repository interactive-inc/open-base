import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { appendSystemAuditEvent } from "@system/interface/operations/append-system-audit-event"
import { prepareSystemAuditEventAppend } from "@system/interface/operations/prepare-system-audit-event-append"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

function auditEvent() {
  const event = SystemAuditEventEntity.create({
    actorAccountId: "7",
    action: "auth.session.logout",
    targetType: "account",
    targetId: "7",
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: null,
    metadataJson: null,
    occurredAt: new Date("2026-01-01T00:00:00.000Z"),
  })
  if (event instanceof Error) throw event
  return event
}

describe("System audit event operations", () => {
  test("呼び出し側のbatchへ追加するappend文を返す", async () => {
    const { context } = await SystemSessionTestContext.create()
    expect(
      prepareSystemAuditEventAppend({ database: context.env.DB, event: auditEvent() }),
    ).toHaveLength(2)
  })

  test("監査イベントを照合文と同じbatchで追記する", async () => {
    const { database } = await SystemSessionTestContext.create()
    const event = auditEvent()
    expect(await appendSystemAuditEvent({ database, event })).toBeUndefined()
    expect(
      await database
        .prepare("SELECT actor_account_id FROM system_audit_events WHERE event_id = ?1")
        .bind(event.eventId)
        .first<Record<string, unknown>>(),
    ).toEqual({ actor_account_id: "7" })

    const rejected = await appendSystemAuditEvent({
      database,
      event: auditEvent(),
      assertions: [database.prepare("SELECT json_extract('{}', 'changed') AS ok")],
    })
    expect(rejected).toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT COUNT(*) AS count FROM system_audit_events")
        .first<Record<string, unknown>>(),
    ).toEqual({
      count: 1,
    })
  })
})
