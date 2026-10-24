import { sql } from "drizzle-orm"
import { auditDisclosureFieldSchema } from "@system/domain/schemas/audit/system-audit-disclosure-policy.schema"
import type { SystemAuditDisclosureValue } from "@system/domain/values/audit/system-audit-disclosure.value"
import type { z } from "zod"

type Context = Readonly<{ value: SystemAuditDisclosureValue }>

/** 開示済みの列を射影と絞り込みの両方へ提供する。 */
export class SystemAuditDisclosureSqlAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  field(field: z.output<typeof auditDisclosureFieldSchema>) {
    const name = auditDisclosureFieldSchema.parse(field)
    return this.c.value.fields.includes(name) ? sql.raw(name) : sql`NULL`
  }

  condition() {
    return this.c.value.targetTypes === null
      ? sql`1 = 1`
      : sql`target_type IN (SELECT value FROM json_each(${JSON.stringify(this.c.value.targetTypes)}))`
  }

  projection() {
    return sql<string>`json_object('eventId', event_id, 'actorAccountId', ${this.field("actor_account_id")},
      'action', action, 'targetType', target_type, 'targetId', ${this.field("target_id")}, 'outcome', outcome,
      'reasonCode', ${this.field("reason_code")}, 'authorizationJson', ${this.field("authorization_json")},
      'beforeJson', ${this.field("before_json")}, 'afterJson', ${this.field("after_json")}, 'metadataJson', ${this.field("metadata_json")},
      'occurredAtEpochMilliseconds', occurred_at,
      'redactedFields', json(${JSON.stringify(auditDisclosureFieldSchema.options.filter((field) => !this.c.value.fields.includes(field)))}))`.as(
      "snapshot_json",
    )
  }
}
