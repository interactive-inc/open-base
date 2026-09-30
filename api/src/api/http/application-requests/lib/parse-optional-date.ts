/** 空値をnull、有効な日時をDateへ変換する。 */
export function parseOptionalDate(value: string | undefined): Date | null {
  if (value === undefined || value === "") return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}
