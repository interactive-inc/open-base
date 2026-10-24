/** 製品dashboardのうち業務contextが出す値。業務contextが無い構成では0のままになる。 */
export type DashboardBusinessMetrics = {
  open_goal_count: number
  open_survey_count: number
  goal_status_summary: { draft: number; in_progress: number; completed: number }
  goal_completion_rate: number
}

export const EMPTY_DASHBOARD_BUSINESS_METRICS: Readonly<DashboardBusinessMetrics> = Object.freeze({
  open_goal_count: 0,
  open_survey_count: 0,
  goal_status_summary: Object.freeze({ draft: 0, in_progress: 0, completed: 0 }),
  goal_completion_rate: 0,
})
