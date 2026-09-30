import type { CompanyResource, CompanyResourceType } from "@/lib/api/types/company-resource-types"

/**
 * 汎用 resource 一覧から 1 つの type だけを取り出し、有効開始日の昇順に並べる。
 * 汎用 route は複数 type をまとめて返すので、画面ごとに種別へ振り分ける。
 */
export function filterResourcesByType(
  resources: ReadonlyArray<CompanyResource>,
  type: CompanyResourceType,
): ReadonlyArray<CompanyResource> {
  return resources
    .filter((resource) => resource.type === type)
    .toSorted((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
}
