import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { WorkforcePeriodVersion } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type { OrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export const organizationUnitKinds = ["COMPANY", "DIVISION", "DEPARTMENT", "TEAM", "OTHER"] as const

export type OrganizationUnitKind = (typeof organizationUnitKinds)[number]

/**
 * OrgUnit identity に対する有効期間付きの名称・分類・親子関係。
 * 訂正は同じ periodId の新 revision、改組は新しい periodId として追記する。
 */
export type OrganizationUnitPeriod = WorkforcePeriodVersion &
  Readonly<{
    organizationUnitId: OrganizationUnitId
    code: string
    officialName: string
    kind: OrganizationUnitKind
    parentOrganizationUnitId: OrganizationUnitId | null
  }>

/** 一回のCompany組織解決で固定するOrgUnit projection。 */
export type OrganizationUnitSnapshot = Readonly<{
  revision: number
  asOf: CalendarDate
  units: ReadonlyArray<OrganizationUnitPeriod>
}>
