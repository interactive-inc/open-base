import type { CompanyResource } from "@/lib/api/types/company-resource-types"

/**
 * resource の有効期間を「2026-04-01 〜 2027-03-31」の形にする。
 * 終了日が null のものは期限なしなので「2026-04-01 〜」と開いたまま示す。
 */
export function toResourcePeriodLabel(resource: CompanyResource): string {
  if (resource.effectiveTo === null) {
    return `${resource.effectiveFrom} 〜`
  }

  return `${resource.effectiveFrom} 〜 ${resource.effectiveTo}`
}
