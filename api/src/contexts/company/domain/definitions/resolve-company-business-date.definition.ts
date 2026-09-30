import { CompanyTimeZoneError } from "@/contexts/company/domain/errors"
import { type CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"

/** UTC instant と会社タイムゾーンから Company の営業日を解決する。 */
export function resolveCompanyBusinessDate(props: {
  now: string
  timeZone: string | undefined
}): CalendarDate | CompanyTimeZoneError {
  if (props.timeZone === undefined || props.timeZone.trim().length === 0) {
    return new CompanyTimeZoneError()
  }

  const instant = new Date(props.now)
  if (!Number.isFinite(instant.getTime())) return new CompanyTimeZoneError()

  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: props.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant)
    const year = parts.find((part) => part.type === "year")?.value
    const month = parts.find((part) => part.type === "month")?.value
    const day = parts.find((part) => part.type === "day")?.value
    const value = `${year ?? ""}-${month ?? ""}-${day ?? ""}`

    return isCalendarDate(value) ? value : new CompanyTimeZoneError()
  } catch (error) {
    return new CompanyTimeZoneError({ cause: error })
  }
}
