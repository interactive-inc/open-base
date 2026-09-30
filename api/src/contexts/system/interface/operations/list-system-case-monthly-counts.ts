import { ListSystemCaseMonthlyCountsAdapter } from "@system/infrastructure/adapters/workflow/list-system-case-monthly-counts.adapter"

/** 指定日時以降のSystem Case作成件数をUTC月単位で返す。 */
export function listSystemCaseMonthlyCounts(
  context: ConstructorParameters<typeof ListSystemCaseMonthlyCountsAdapter>[0],
  ...input: Parameters<ListSystemCaseMonthlyCountsAdapter["listSystemCaseMonthlyCounts"]>
): ReturnType<ListSystemCaseMonthlyCountsAdapter["listSystemCaseMonthlyCounts"]> {
  return new ListSystemCaseMonthlyCountsAdapter(context).listSystemCaseMonthlyCounts(...input)
}
