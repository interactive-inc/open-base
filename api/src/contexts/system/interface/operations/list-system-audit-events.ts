import type { PreparedSystemAuditDisclosure } from "@system/infrastructure/adapters/audit/system-audit-disclosure-read.adapter"
import { SystemAuditEventQueryAdapter } from "@system/infrastructure/adapters/audit/system-audit-event-query.adapter"
import type { SQL } from "drizzle-orm"

/** 開示条件と追加の製品フィルターを適用して監査イベントを読む。 */
export function listSystemAuditEvents(
  database: D1Database,
  query: Parameters<SystemAuditEventQueryAdapter["list"]>[0],
  disclosure: PreparedSystemAuditDisclosure,
  additionalCondition?: SQL,
) {
  return new SystemAuditEventQueryAdapter({ env: { DB: database } }).list(
    query,
    disclosure,
    additionalCondition,
  )
}
