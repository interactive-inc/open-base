import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyEmploymentResourceTimelineValue } from "@/contexts/company/domain/values/company-employment-resource-timeline.value"
import { CompanyEmploymentResourceHistoryAdapter } from "@/contexts/company/infrastructure/adapters/employee/company-employment-resource-history.adapter"

/** 訂正後の雇用履歴から、指定した会社版における各雇用の開始日を一括取得する。 */
export async function readCompanyEmploymentStartDates(
  input: Readonly<{
    database: D1Database
    organizationId: string
    employmentIds: ReadonlyArray<string>
    organizationRevision: number
  }>,
): Promise<ReadonlyMap<string, CalendarDate> | Error> {
  const employmentIds = [...new Set(input.employmentIds)]
  if (
    !CompanyResourceEntity.isIdentifier(input.organizationId) ||
    employmentIds.length < 1 ||
    employmentIds.length > 100 ||
    !employmentIds.every(CompanyResourceEntity.isIdentifier)
  ) {
    return new Error("Invalid Company employment start date query")
  }
  const histories = await new CompanyEmploymentResourceHistoryAdapter(input.database).readMany({
    organizationId: input.organizationId,
    employmentIds,
    organizationRevision: input.organizationRevision,
  })
  if (histories instanceof Error) return histories

  const startsOnByEmployment = new Map<string, CalendarDate>()
  for (const employmentId of employmentIds) {
    const history = histories.get(employmentId)
    if (history === undefined) return new Error("Company employment history is unavailable")
    const timeline = CompanyEmploymentResourceTimelineValue.create(history)
    if (timeline instanceof Error) return timeline
    if (timeline.startsOn === null) return new Error("Company employment start is unavailable")
    startsOnByEmployment.set(employmentId, timeline.startsOn)
  }
  return startsOnByEmployment
}
