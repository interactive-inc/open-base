import { ReviewRecordRetirementAdapter } from "@system/infrastructure/adapters/records/review-record-retirement.adapter"

/** 固定した撤去計画と検査結果を現在の判断資格で開示し、開示前に監査を確定する。 */
export function reviewSystemRecordRetirement(
  context: ConstructorParameters<typeof ReviewRecordRetirementAdapter>[0],
  ...input: Parameters<ReviewRecordRetirementAdapter["execute"]>
): ReturnType<ReviewRecordRetirementAdapter["execute"]> {
  return new ReviewRecordRetirementAdapter(context).execute(...input)
}
