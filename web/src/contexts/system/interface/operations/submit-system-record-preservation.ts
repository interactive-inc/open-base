import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"

/** 原記録の保全申請を承認手続きへ提出する。 */
export function submitSystemRecordPreservation(
  context: ConstructorParameters<typeof SubmitRecordPreservationAdapter>[0],
  ...input: Parameters<SubmitRecordPreservationAdapter["execute"]>
): ReturnType<SubmitRecordPreservationAdapter["execute"]> {
  return new SubmitRecordPreservationAdapter(context).execute(...input)
}
