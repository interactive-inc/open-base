import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

describe("SystemAuditEventRepository", () => {
  test("appends an AccountEntity-scoped event to the standalone System table", async () => {
    const { context, database } = await SystemSessionTestContext.create()
    const record = SystemAuditEventEntity.create({
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
      occurredAt: new Date("2026-01-01T00:00:00.123Z"),
    })
    if (record instanceof Error) throw record
    expect(await new SystemAuditEventRepository(context).append(record)).toBeUndefined()

    const stored = await database
      .prepare(`SELECT event_id, actor_account_id, occurred_at
         FROM system_audit_events
         WHERE event_id = ?1`)
      .bind(record.eventId)
      .first<Record<string, unknown>>()

    expect(stored).toEqual({
      event_id: record.eventId,
      actor_account_id: "7",
      occurred_at: Date.parse("2026-01-01T00:00:00.123Z"),
    })

    expect(
      await database
        .prepare("SELECT COUNT(*) AS count FROM system_audit_events")
        .first<Record<string, unknown>>(),
    ).toEqual({
      count: 1,
    })
  })

  test("fails closed when the audit insert is silently ignored", async () => {
    const { context, database } = await SystemSessionTestContext.create()
    const record = SystemAuditEventEntity.create({
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
    if (record instanceof Error) throw record
    await execSql(
      database,
      `
      CREATE TRIGGER ignore_system_audit_insert
      BEFORE INSERT ON system_audit_events
      WHEN NEW.event_id = '${record.eventId}'
      BEGIN
        SELECT RAISE(IGNORE);
      END;
    `,
    )

    expect(await new SystemAuditEventRepository(context).append(record)).toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT COUNT(*) AS count FROM system_audit_events WHERE event_id = ?1")
        .bind(record.eventId)
        .first<Record<string, unknown>>(),
    ).toEqual({ count: 0 })
  })
})
