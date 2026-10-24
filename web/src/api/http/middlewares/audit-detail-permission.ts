import { AuditTrail } from "@/api/http/audit/audit-trail"
import { factory } from "@/api/http/factory"

/** 監査ログ詳細の権限ゲート。audit:read が無ければ denied を記録して 403。 */
export const auditDetailPermission = factory.createMiddleware((c, next) =>
  new AuditTrail(c).requireReadPermission("detail", next),
)
