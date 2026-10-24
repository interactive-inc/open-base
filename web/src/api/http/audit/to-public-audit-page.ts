import type { CompanyAuditEventPage as AuditEventPage } from "@/contexts/company/interface/operations/open-company-audit-events"
import { auditUnavailable } from "@/api/http/audit/audit-unavailable"
import { toPublicAuditSummary } from "@/api/http/audit/to-public-audit-summary"
import { zAppAuditEventPage } from "@/api/http/audit/response-schemas"
import type { AppAuditEventPage } from "@/api/http/audit/response-schemas"

/** Projects a repository page into the public list contract, failing closed on any drift. */
export function toPublicAuditPage(page: AuditEventPage): AppAuditEventPage {
  try {
    return zAppAuditEventPage.parse({
      data: page.items.map(toPublicAuditSummary),
      next_cursor: page.nextCursor,
      previous_cursor: page.previousCursor,
    })
  } catch (error) {
    throw auditUnavailable(error)
  }
}
