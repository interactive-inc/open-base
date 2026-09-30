import type { AuditEventDetail } from "@/contexts/company/domain/definitions/company-audit-event.definition"
import { auditUnavailable } from "@/api/http/audit/audit-unavailable"
import { toPublicAuditSummary } from "@/api/http/audit/to-public-audit-summary"
import { zAppAuditEventDetail } from "@/api/http/audit/response-schemas"
import type { AppAuditEventDetail } from "@/api/http/audit/response-schemas"

/** Projects a repository detail into the public contract, failing closed on any drift. */
export function toPublicAuditDetail(item: AuditEventDetail): AppAuditEventDetail {
  try {
    return zAppAuditEventDetail.parse({
      ...toPublicAuditSummary(item),
      authorization_json: item.authorizationJson,
      before_json: item.beforeJson,
      after_json: item.afterJson,
      metadata_json: item.metadataJson,
      client_ip: item.clientIp,
    })
  } catch (error) {
    throw auditUnavailable(error)
  }
}
