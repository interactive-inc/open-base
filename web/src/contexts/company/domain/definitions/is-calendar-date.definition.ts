import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { daysInCalendarMonth } from "@/contexts/company/domain/definitions/days-in-calendar-month.definition"

/** YYYY-MM-DDの実在する暦日だけを受理する。時刻・timezoneへ依存しない。 */
export function isCalendarDate(value: string): value is CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1) return false

  return day <= daysInCalendarMonth(year, month)
}
