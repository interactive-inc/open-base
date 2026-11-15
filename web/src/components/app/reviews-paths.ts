/**
 * 評価の画面が読む `/api` の経路。loaderと画面で同じ経路を使い、先に読んだ結果をそのまま渡す。
 * 一覧は一度に読める上限の100件を読む。
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 評価の識別子として読めるか。読めない値はAPIへ渡さず、見つからない扱いにする。 */
export function isReviewId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value)
}

export const reviewApi = {
  cycles: "/performance-review/cycles?limit=100",
  cycle: (id: string) => `/performance-review/cycles/${id}`,
  mySheets: (cycleId?: string) =>
    `/performance-review/sheets?scope=mine&limit=100${cycleId === undefined ? "" : `&cycle_id=${cycleId}`}`,
  inbox: (cycleId?: string) =>
    `/performance-review/sheets?scope=inbox&limit=100${cycleId === undefined ? "" : `&cycle_id=${cycleId}`}`,
  allSheets: (cycleId: string) =>
    `/performance-review/sheets?scope=all&limit=100&cycle_id=${cycleId}`,
  sheet: (id: string) => `/performance-review/sheets/${id}`,
  history: (id: string) => `/performance-review/sheets/${id}/history?limit=100`,
} as const
