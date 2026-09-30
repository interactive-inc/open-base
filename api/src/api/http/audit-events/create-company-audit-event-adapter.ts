import {
  openCompanyAuditEvents,
  type CompanyAuditEvents,
} from "@/contexts/company/interface/operations/open-company-audit-events"
import type { Context } from "@/env"

export type CompanyAuditExportRows = Awaited<ReturnType<CompanyAuditEvents["export"]>>

/** Companyの公開監査projectionを製品audit compositionへ接続する。 */
export function createCompanyAuditEventAdapter(context: Context): CompanyAuditEvents {
  return openCompanyAuditEvents(context)
}
