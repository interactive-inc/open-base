import { DecideRecordRetirementAdapter } from "@system/infrastructure/adapters/records/decide-record-retirement.adapter"

/** 記録撤去の申請へ人の肯定・否定判断を記録する。 */
export function decideSystemRecordRetirement(
  context: ConstructorParameters<typeof DecideRecordRetirementAdapter>[0],
  ...input: Parameters<DecideRecordRetirementAdapter["execute"]>
): ReturnType<DecideRecordRetirementAdapter["execute"]> {
  return new DecideRecordRetirementAdapter(context).execute(...input)
}
