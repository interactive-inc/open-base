import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

/** System監査イベントを前後の照合文と同じD1 batchで追記する。 */
export function appendSystemAuditEvent(
  input: Readonly<{
    database: D1Database
    event: SystemAuditEventEntity
    assertions?: ReadonlyArray<D1PreparedStatement>
    completionAssertions?: ReadonlyArray<D1PreparedStatement>
  }>,
): Promise<void | Error> {
  return new SystemAuditEventRepository({ env: { DB: input.database } }).append(
    input.event,
    input.assertions ?? [],
    input.completionAssertions ?? [],
  )
}
