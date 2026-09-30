/** 指定時刻を含む直近6か月のYYYY-MMを古い順に返す。 */
export function buildDashboardMonthLabels(now: string): ReadonlyArray<string> {
  const date = new Date(now)
  const labels: string[] = []

  for (let offset = 5; offset >= 0; offset -= 1) {
    const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - offset, 1))
    labels.push(
      `${String(month.getUTCFullYear())}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`,
    )
  }

  return labels
}
