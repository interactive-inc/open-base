import { CountPendingSystemCasesAdapter } from "@system/infrastructure/adapters/workflow/count-pending-system-cases.adapter"

/** 未完了System Caseの件数を数える。 */
export function countPendingSystemCases(
  context: ConstructorParameters<typeof CountPendingSystemCasesAdapter>[0],
  ...input: Parameters<CountPendingSystemCasesAdapter["countPendingSystemCases"]>
): ReturnType<CountPendingSystemCasesAdapter["countPendingSystemCases"]> {
  return new CountPendingSystemCasesAdapter(context).countPendingSystemCases(...input)
}
