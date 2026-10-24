import { formatDateTime } from "@/lib/format-date-time"

/**
 * 照合の created_at は SQL の row をそのまま返すぶん epoch の数値で届く。
 * 範囲外の数値は Date が例外を投げるので、ISO へ直す前にここで弾く。
 */
export function formatEpochMilliseconds(epochMilliseconds: number): string {
  const date = new Date(epochMilliseconds)

  if (Number.isNaN(date.getTime())) return "-"

  return formatDateTime(date.toISOString())
}
