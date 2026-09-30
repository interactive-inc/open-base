import { CompanyReportingRelationsReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-reporting-relations-read.adapter"
import { ReadOrganizationWorkforceState } from "@/contexts/company/lib/workforce/read-organization-workforce-state"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import { OrganizationWorkforceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-workforce-snapshot.adapter"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import {
  CompanyConflictError,
  CompanyUnavailableError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"

/** 既存App向けに、会社営業日時点の検証済みcanonical Company snapshotを一度だけ読む。 */
async function readCanonicalOrganizationState(c: CompanyContext, asOf?: CalendarDate) {
  const businessDate =
    asOf ??
    resolveCompanyBusinessDate({
      now: c.env.NOW ?? new Date().toISOString(),
      timeZone: c.env.COMPANY_TIME_ZONE,
    })
  if (typeof businessDate !== "string") {
    return new CompanyUnexpectedError("会社営業日を解決できません", { cause: businessDate })
  }
  const result = await new ReadOrganizationWorkforceState({
    organization: new OrganizationUnitReadAdapter(c.var.database),
    workforce: new OrganizationWorkforceSnapshotAdapter(c),
    reporting: new CompanyReportingRelationsReadAdapter(c.env.DB),
  }).execute(restoreCalendarDate(businessDate))
  if (result.kind === "unavailable") {
    return new CompanyUnavailableError(
      "Company組織snapshotを読み出せません",
      "organization_snapshot_unavailable",
      { cause: result.cause },
    )
  }
  if (result.kind === "invalid") {
    return new CompanyConflictError(
      "Company組織snapshotが不整合です",
      "code" in result.error ? String(result.error.code) : "organization_snapshot_invalid",
      { cause: result.error },
    )
  }
  return result
}
type Context = CompanyContext

export class ReadCanonicalOrganizationStateAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async readCanonicalOrganizationState(asOf?: CalendarDate) {
    return readCanonicalOrganizationState(this.c, asOf)
  }
}
