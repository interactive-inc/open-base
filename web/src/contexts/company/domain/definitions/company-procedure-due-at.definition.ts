/**
 * 期限日時を求める。起点 ISO 文字列に due_days を加えた ISO 文字列を返す。
 * due_days が null、または起点が不正な日付なら null
 */
export function dueAt(startedAt: string, dueDays: number | null): string | null {
  if (dueDays === null) return null

  const date = new Date(startedAt)

  if (Number.isNaN(date.getTime())) return null

  date.setUTCDate(date.getUTCDate() + dueDays)

  return date.toISOString()
}
