import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { OrganizationalAuthorityReportingRelationEvidence } from "@/contexts/company/domain/definitions/organizational-authority.definition"

export type CompanyReportingRelationsReadResult =
  | Readonly<{
      ok: true
      companyRevision: number
      relations: ReadonlyArray<OrganizationalAuthorityReportingRelationEvidence>
    }>
  | Readonly<{ ok: false; cause: unknown }>

export type CompanyReportingRelationsReadPort = Readonly<{
  readSnapshot(asOf: CalendarDate): Promise<CompanyReportingRelationsReadResult>
  readRevision(): Promise<
    Readonly<{ ok: true; revision: number }> | Readonly<{ ok: false; cause: unknown }>
  >
}>
