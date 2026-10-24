import { auditUnavailable } from "@/api/http/audit/audit-unavailable"

/** Converts a repository Unix-second timestamp into the public UTC representation. */
export function toAuditIsoString(epoch: number): string {
  try {
    if (!Number.isSafeInteger(epoch)) throw new Error("audit epoch is not a safe integer")
    const date = new Date(epoch * 1_000)
    if (!Number.isFinite(date.getTime())) throw new Error("audit epoch cannot be represented")
    return date.toISOString()
  } catch (error) {
    throw auditUnavailable(error)
  }
}
