import { InvalidBusinessDateError } from "@/contexts/company/domain/errors"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"

/** YYYY-MM-DD の翌暦日を UTC 基準で返す。 */
export function nextCalendarDate(value: string): string | InvalidBusinessDateError {
  if (!isCalendarDate(value)) return new InvalidBusinessDateError()

  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)

  try {
    const result = date.toISOString().slice(0, 10)
    return isCalendarDate(result) ? result : new InvalidBusinessDateError()
  } catch (error) {
    return new InvalidBusinessDateError({ cause: error })
  }
}
