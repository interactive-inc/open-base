import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

/** 呼び出し側の業務statementと同じD1 batchへ追加する、System監査イベントのappend文を返す。 */
export function prepareSystemAuditEventAppend(
  input: Readonly<{ database: D1Database; event: SystemAuditEventEntity }>,
): readonly [D1PreparedStatement, D1PreparedStatement] {
  return new SystemAuditEventRepository({ env: { DB: input.database } }).prepareAppend(input.event)
}
