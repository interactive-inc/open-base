const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

/** ISO 8601 文字列を "2026/05/25 12:00" 形式に変換する */
export function formatDateTime(isoString: string | null | undefined): string {
  if (isoString === null || isoString === undefined) {
    return "-"
  }

  const date = new Date(isoString)

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  return dateTimeFormatter.format(date)
}
