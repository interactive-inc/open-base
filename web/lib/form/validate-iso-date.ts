function isRealCalendarDate(value: string): boolean {
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

export function validateIsoDate(value: string, label: string): string | Error {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) === false || isRealCalendarDate(value) === false) {
    return new Error(`${label}はYYYY-MM-DD形式の実在する日付で入力してください`)
  }

  return value
}
