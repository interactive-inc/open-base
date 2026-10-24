import { DecideRecordPreservationAdapter } from "@system/infrastructure/adapters/records/decide-record-preservation.adapter"

/** 記録保全の申請へ人の肯定・否定判断を記録する。 */
export function decideSystemRecordPreservation(
  context: ConstructorParameters<typeof DecideRecordPreservationAdapter>[0],
  ...input: Parameters<DecideRecordPreservationAdapter["execute"]>
): ReturnType<DecideRecordPreservationAdapter["execute"]> {
  return new DecideRecordPreservationAdapter(context).execute(...input)
}
