import { WithdrawRecordPreservationAdapter } from "@system/infrastructure/adapters/records/withdraw-record-preservation.adapter"

/** 判断前の記録保全申請を申請者が取り下げる。 */
export function withdrawSystemRecordPreservation(
  context: ConstructorParameters<typeof WithdrawRecordPreservationAdapter>[0],
  ...input: Parameters<WithdrawRecordPreservationAdapter["execute"]>
): ReturnType<WithdrawRecordPreservationAdapter["execute"]> {
  return new WithdrawRecordPreservationAdapter(context).execute(...input)
}
