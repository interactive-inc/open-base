import type { CompanyAuditEventFilters as AuditEventFilters } from "@/contexts/company/interface/operations/open-company-audit-events"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { auditUnavailable } from "@/api/http/audit/audit-unavailable"

const FILTER_HASH_PREFIX = "open-base:audit:filters:v1\0"

/** Hashes only normalized filter values, excluding cursor, limit and raw input spellings. */
export async function hashAuditFilters(filters: AuditEventFilters): Promise<string> {
  try {
    const normalized = {
      actor_account_id: filters.actorAccountId ?? null,
      action: filters.action ?? null,
      target_type: filters.targetType ?? null,
      target_id: filters.targetId ?? null,
      outcome: filters.outcome ?? null,
      from_epoch: filters.fromEpoch ?? null,
      to_epoch: filters.toEpoch ?? null,
    }
    const canonical = CanonicalSystemJsonValue.create(normalized)
    if (canonical instanceof Error) throw canonical
    const bytes = new TextEncoder().encode(`${FILTER_HASH_PREFIX}${canonical.toString()}`)
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
    return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")
  } catch (error) {
    throw auditUnavailable(error)
  }
}
