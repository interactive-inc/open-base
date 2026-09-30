const auditDateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Tokyo",
  timeZoneName: "short",
})

export function formatAuditDateTime(value: string): string {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? auditDateTimeFormatter.format(date) : "—"
}
