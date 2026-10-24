import { ReviewRecordPreservationAdapter } from "@system/infrastructure/adapters/records/review-record-preservation.adapter"

/** 記録保全の判断対象と原文を現在の資格で開示し、返却前に開示監査を確定する。 */
export function reviewSystemRecordPreservation(
  context: ConstructorParameters<typeof ReviewRecordPreservationAdapter>[0],
  ...input: Parameters<ReviewRecordPreservationAdapter["execute"]>
): ReturnType<ReviewRecordPreservationAdapter["execute"]> {
  return new ReviewRecordPreservationAdapter(context).execute(...input)
}
