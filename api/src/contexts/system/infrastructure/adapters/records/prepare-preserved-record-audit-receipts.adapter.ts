import type { SystemD1Context } from "@system/configuration/system-context"
import type { PreparedSystemAuditDisclosure } from "@system/infrastructure/adapters/audit/system-audit-disclosure-read.adapter"
import { SystemAuditEventQueryAdapter } from "@system/infrastructure/adapters/audit/system-audit-event-query.adapter"
import { auditDisclosureFieldSchema } from "@system/domain/schemas/audit/system-audit-disclosure-policy.schema"
import type { SystemAuditDisclosedEvent } from "@system/domain/schemas/audit/system-audit-disclosed-event.schema"
import { PreservedRecordDisclosureDeniedError } from "@system/domain/errors"
import { sql } from "drizzle-orm"

type Context = SystemD1Context

/** 保全・保持・開示版が参照する監査を全件要求し、欠損や非開示を完全な出力へ混ぜない。 */
export class PreparePreservedRecordAuditReceiptsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(eventIds: ReadonlyArray<string>, disclosure: PreparedSystemAuditDisclosure) {
    if (disclosure.assertions.length === 0)
      return new Error("audit receipt authorization is required")
    if (
      !auditDisclosureFieldSchema.options.every((field) => disclosure.value.fields.includes(field))
    )
      return new PreservedRecordDisclosureDeniedError()
    if (eventIds.length === 0 || eventIds.some((id) => id.length === 0 || id.length > 256))
      return new Error("required audit receipt identifiers are invalid")
    const ids = [...new Set(eventIds)].toSorted()
    const events: SystemAuditDisclosedEvent[] = []
    const guards: D1PreparedStatement[] = []
    const reader = new SystemAuditEventQueryAdapter(this.c)
    const chunks = Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) =>
      ids.slice(index * 100, (index + 1) * 100),
    )
    for (const chunk of chunks) {
      const encoded = JSON.stringify(chunk)
      const page = await reader.list(
        {
          action: null,
          actorAccountId: null,
          outcome: null,
          targetType: null,
          targetId: null,
          occurredFrom: null,
          occurredTo: null,
          limit: 100,
          offset: 0,
        },
        disclosure,
        sql`event_id IN (SELECT value FROM json_each(${encoded}))`,
      )
      if (page instanceof Error) return page
      if (page.total !== chunk.length || page.events.length !== chunk.length)
        return new Error("required audit receipts are missing or undisclosed")
      for (const event of page.events) {
        if (!chunk.includes(event.eventId) || event.redactedFields.length !== 0)
          return new Error("required audit receipt is incomplete")
        events.push(event)
      }
      guards.push(
        this.c.env.DB.prepare(`SELECT CASE WHEN COUNT(*) = ?2 THEN 1
        ELSE json_extract('{}', 'record_audit_receipts_changed') END
        FROM system_audit_events WHERE event_id IN (SELECT value FROM json_each(?1))`).bind(
          encoded,
          chunk.length,
        ),
      )
    }
    return Object.freeze({
      events: Object.freeze(
        events.toSorted((left, right) => left.eventId.localeCompare(right.eventId)),
      ),
      guards: Object.freeze(guards),
    })
  }
}
