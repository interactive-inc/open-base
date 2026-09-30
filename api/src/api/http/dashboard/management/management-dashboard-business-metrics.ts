import type { AppManagementDashboard } from "@/api/http/company/response-schemas"

/** 経営dashboardのうち業務contextが出す値。業務contextが無い構成では0または空のままになる。 */
export type ManagementDashboardBusinessMetrics = Pick<
  AppManagementDashboard,
  | "attendance_record_count"
  | "leave_request_count"
  | "leave_pending_count"
  | "expense_count"
  | "expense_pending_count"
  | "open_review_cycle_count"
  | "goal_done_rates"
>

/** 各業務の集計へ渡す、対象月の前方一致の条件。 */
export type ManagementDashboardMetricInput = Readonly<{ monthLike: string }>

export const EMPTY_MANAGEMENT_DASHBOARD_BUSINESS_METRICS: Readonly<ManagementDashboardBusinessMetrics> =
  Object.freeze({
    attendance_record_count: 0,
    leave_request_count: 0,
    leave_pending_count: 0,
    expense_count: 0,
    expense_pending_count: 0,
    open_review_cycle_count: 0,
    goal_done_rates: [],
  })
