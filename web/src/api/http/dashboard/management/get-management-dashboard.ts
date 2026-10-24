import { readCompanyCanonicalOrganizationState } from "@/contexts/company/interface/operations/read-company-canonical-organization-state"
import { readCompanyEmploymentMovements } from "@/contexts/company/interface/operations/read-company-employment-movements"
import {
  EMPTY_MANAGEMENT_DASHBOARD_BUSINESS_METRICS,
  type ManagementDashboardBusinessMetrics,
} from "@/api/http/dashboard/management/management-dashboard-business-metrics"
import type { Context } from "@/env"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { toManagementDashboardRanges } from "@/api/http/dashboard/management/to-management-dashboard-ranges"
import type { AppManagementDashboard } from "@/api/http/company/response-schemas"
import { countPendingSystemCases } from "@system/interface/operations/count-pending-system-cases"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

/**
 * 経営ダッシュボードの横断集計。予測・計算は持たず、在籍・入退社・申請の件数と、業務contextごとの
 * providerの値を数えるだけ。業務contextが無い構成では、その業務の値を0として同じ形の応答を返す。
 * 基準時刻は c.env.NOW(テスト固定)か実時計。
 */
export class GetManagementDashboard {
  constructor(private readonly c: Context) {}

  async run(): Promise<AppManagementDashboard | ApplicationError> {
    const nowIso = this.c.env.NOW ?? new Date().toISOString()

    const businessDate = resolveCompanyBusinessDate({
      now: nowIso,
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (businessDate instanceof Error)
      return new UnexpectedError("failed to resolve company business date", { cause: businessDate })
    const ranges = toManagementDashboardRanges(nowIso)
    const employmentRanges = toManagementDashboardRanges(`${businessDate}T00:00:00.000Z`)

    try {
      const pendingApplicationCount = await countPendingSystemCases({
        env: { DB: this.c.env.DB },
      })
      if (pendingApplicationCount instanceof Error) {
        return new UnexpectedError("failed to aggregate management dashboard", {
          cause: pendingApplicationCount,
        })
      }

      const companySnapshot = await readCompanyCanonicalOrganizationState(this.c)
      if (companySnapshot instanceof Error) {
        return new UnexpectedError("failed to aggregate management dashboard", {
          cause: companySnapshot,
        })
      }
      const movements = await readCompanyEmploymentMovements(this.c, {
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        organizationRevision: companySnapshot.companyRevision,
        from: employmentRanges.since,
        through: businessDate,
      })
      if (movements instanceof Error)
        return new UnexpectedError("failed to aggregate confirmed employment movements", {
          cause: movements,
        })
      const activeStates = companySnapshot.employees.filter((state) => state.status === "ACTIVE")
      const unitById = new Map(
        companySnapshot.organization.units.map((unit) => [unit.organizationUnitId, unit]),
      )
      const headcountByUnitName = new Map<string, number>()
      for (const state of activeStates) {
        if (state.primaryAssignment === null) continue
        const unit = unitById.get(state.primaryAssignment.organizationUnitId)
        if (unit === undefined) continue
        headcountByUnitName.set(
          unit.officialName,
          (headcountByUnitName.get(unit.officialName) ?? 0) + 1,
        )
      }

      const providerMetrics = [] as Partial<ManagementDashboardBusinessMetrics>[]
      const business: ManagementDashboardBusinessMetrics = {
        ...EMPTY_MANAGEMENT_DASHBOARD_BUSINESS_METRICS,
      }
      for (const metrics of providerMetrics) Object.assign(business, metrics)

      return {
        employee_count: activeStates.length,
        department_headcounts: [...headcountByUnitName]
          .map(([department_name, headcount]) => ({ department_name, headcount }))
          .toSorted((left, right) => right.headcount - left.headcount),
        recent_join_count: movements.joinCount,
        recent_retire_count: movements.retireCount,
        attendance_record_count: business.attendance_record_count,
        leave_request_count: business.leave_request_count,
        leave_pending_count: business.leave_pending_count,
        expense_count: business.expense_count,
        expense_pending_count: business.expense_pending_count,
        open_review_cycle_count: business.open_review_cycle_count,
        pending_application_count: pendingApplicationCount,
        goal_done_rates: business.goal_done_rates,
      }
    } catch (error) {
      return new UnexpectedError("failed to aggregate management dashboard", { cause: error })
    }
  }
}
