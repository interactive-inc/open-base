import { AuditTrail } from "@/api/http/audit/audit-trail"
import { factory } from "@/api/http/factory"

/** 監査ログ検索の権限ゲート。audit:read が無ければ denied を記録して 403。 */
export const auditListPermission = factory.createMiddleware((c, next) =>
  new AuditTrail(c).requireReadPermission("search", next),
)
