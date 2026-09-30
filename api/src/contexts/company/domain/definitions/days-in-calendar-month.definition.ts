export function daysInCalendarMonth(year: number, month: number): number {
  const leapYear = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0)
  return [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0
}
