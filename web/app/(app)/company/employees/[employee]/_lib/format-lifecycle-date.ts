const lifecycleDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "long",
  timeZone: "UTC",
})

export function formatLifecycleDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value)
  if (!match) return value
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    return value
  }
  return lifecycleDateFormatter.format(date)
}
