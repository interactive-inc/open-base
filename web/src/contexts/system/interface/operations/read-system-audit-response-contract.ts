import { zAppAuditLogs } from "@system/interface/models/audit-log"

/** 監査一覧の開示応答schemaを読む。 */
export function readSystemAuditResponseContract() {
  return zAppAuditLogs
}
