import { readCompanyCanonicalOrganizationState } from "@/contexts/company/interface/operations/read-company-canonical-organization-state"
import { buildDashboardMonthLabels } from "@/api/http/dashboard/build-dashboard-month-labels"
import {
  EMPTY_DASHBOARD_BUSINESS_METRICS,
  type DashboardBusinessMetrics,
} from "@/api/http/dashboard/dashboard-business-metrics"
import type { Context } from "@/env"
import { countPendingSystemCases } from "@system/interface/operations/count-pending-system-cases"
import { listSystemCaseMonthlyCounts } from "@system/interface/operations/list-system-case-monthly-counts"

/**
 * System・Companyの集計と、業務contextごとのproviderの値を製品dashboard responseへ合成する。
 * 業務contextが無い構成では、その業務の値を0として同じ形の応答を返す。
 */
export async function readDashboard(context: Context, now: string) {
  const monthLabels = buildDashboardMonthLabels(now)
  const firstMonth = monthLabels[0]
  if (firstMonth === undefined) return new Error("dashboard month window is empty")
  const windowStartDate = new Date(`${firstMonth}-01T00:00:00Z`)

  const [pendingApplicationCount, applicationTrendRows, companySnapshot, providerMetrics] =
    await Promise.all([
      countPendingSystemCases({ env: { DB: context.env.DB } }),
      listSystemCaseMonthlyCounts(
        {
          env: { DB: context.env.DB },
        },
        windowStartDate,
      ),
      readCompanyCanonicalOrganizationState(context),
      Promise.resolve([] as Partial<DashboardBusinessMetrics>[]),
    ])
  if (pendingApplicationCount instanceof Error) return pendingApplicationCount
  if (applicationTrendRows instanceof Error) return applicationTrendRows
  if (companySnapshot instanceof Error) return companySnapshot
  const business: DashboardBusinessMetrics = { ...EMPTY_DASHBOARD_BUSINESS_METRICS }
  for (const metrics of providerMetrics) Object.assign(business, metrics)
  const unitById = new Map(
    companySnapshot.organization.units.map((unit) => [unit.organizationUnitId, unit]),
  )
  const departmentCounts = new Map<string, number>()
  const activeStates = companySnapshot.employees.filter((state) => state.status === "ACTIVE")
  for (const state of activeStates) {
    const name =
      state.primaryAssignment === null
        ? "未所属"
        : (unitById.get(state.primaryAssignment.organizationUnitId)?.officialName ?? "未所属")
    departmentCounts.set(name, (departmentCounts.get(name) ?? 0) + 1)
  }
  const trendByMonth = new Map(applicationTrendRows.map((row) => [row.month, row.total]))

  return {
    employee_count: activeStates.length,
    open_goal_count: business.open_goal_count,
    pending_application_count: pendingApplicationCount,
    open_survey_count: business.open_survey_count,
    department_breakdown: [...departmentCounts].map(([dept_name, count]) => ({
      dept_name,
      count,
    })),
    goal_status_summary: business.goal_status_summary,
    goal_completion_rate: business.goal_completion_rate,
    application_trend: monthLabels.map((month) => ({
      month,
      count: trendByMonth.get(month) ?? 0,
    })),
  }
}
