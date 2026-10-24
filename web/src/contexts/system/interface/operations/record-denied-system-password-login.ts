import { SystemPasswordLoginAuditAdapter } from "@system/infrastructure/adapters/audit/system-password-login-audit.adapter"

/** passwordログインの拒否をSystem監査へ記録する。 */
export function recordDeniedSystemPasswordLogin(
  database: D1Database,
  reasonCode: string,
  occurredAt: Date,
) {
  return new SystemPasswordLoginAuditAdapter({ env: { DB: database } }).recordDenied(
    reasonCode,
    occurredAt,
  )
}
