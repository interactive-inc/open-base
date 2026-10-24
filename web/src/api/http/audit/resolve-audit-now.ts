import { auditUnavailable } from "@/api/http/audit/audit-unavailable"

/** Resolves the injected clock and rejects invalid dates before event generation. */
export function resolveAuditNow(value: string | undefined): Date {
  const date = value === undefined ? new Date() : new Date(value)
  if (!Number.isFinite(date.getTime())) throw auditUnavailable(new Error("audit clock is invalid"))
  return date
}
