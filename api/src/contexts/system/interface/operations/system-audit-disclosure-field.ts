import type { PreparedSystemAuditDisclosure } from "@system/infrastructure/adapters/audit/system-audit-disclosure-read.adapter"
import { SystemAuditDisclosureSqlAdapter } from "@system/infrastructure/adapters/audit/system-audit-disclosure-sql.adapter"

/** 開示が許された監査列だけを検索条件へ渡す。 */
export function systemAuditDisclosureField(
  disclosure: PreparedSystemAuditDisclosure,
  field: Parameters<SystemAuditDisclosureSqlAdapter["field"]>[0],
) {
  return new SystemAuditDisclosureSqlAdapter(disclosure).field(field)
}
