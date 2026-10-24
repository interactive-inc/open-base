import { CompanyWriteUnavailableError } from "@/contexts/company/interface/errors"

/** Companyの記録時刻を取得し、利用できない時計では履歴を保存しない。 */
export function resolveCompanyRecordedAt(clock: (() => Date) | undefined): number {
  const recordedAt = (clock?.() ?? new Date()).getTime()
  if (!Number.isSafeInteger(recordedAt) || recordedAt < 0)
    throw new CompanyWriteUnavailableError(new Error("Company clock is invalid"))
  return recordedAt
}
