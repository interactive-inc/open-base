import type { AuditListQuery } from "@/lib/api/types/audit-types"
import { queryKeys } from "@/app/(app)/system/audit-events/_lib/parse-audit-list-search-params"

/** Builds one canonical audit list URL while treating cursor as an opaque value. */
export function buildAuditEventsHref(query: AuditListQuery, cursor: string | null): string {
  const params = new URLSearchParams()
  for (const key of queryKeys) {
    if (key === "cursor") continue
    const value = query[key]
    if (value !== undefined) params.set(key, value)
  }
  if (cursor !== null) params.set("cursor", cursor)
  const suffix = params.toString()
  return suffix === "" ? "/system/audit-events" : `/system/audit-events?${suffix}`
}
