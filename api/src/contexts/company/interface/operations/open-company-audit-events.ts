import {
  AuditEventAdapter,
  type AuditEventFilters,
  type AuditEventPage,
} from "@/contexts/company/infrastructure/adapters/audit/audit-event.adapter"

export type CompanyAuditEvents = Pick<
  AuditEventAdapter,
  "prepareAppend" | "append" | "search" | "findByEventId" | "export"
>

export type CompanyAuditEventFilters = AuditEventFilters

export type CompanyAuditEventPage = AuditEventPage

/** 監査 event の追記、検索、出力を扱う公開境界。 */
export function openCompanyAuditEvents(
  c: ConstructorParameters<typeof AuditEventAdapter>[0],
): CompanyAuditEvents {
  return new AuditEventAdapter(c)
}
