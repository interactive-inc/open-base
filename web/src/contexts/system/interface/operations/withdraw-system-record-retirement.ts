import { WithdrawRecordRetirementAdapter } from "@system/infrastructure/adapters/records/withdraw-record-retirement.adapter"

/** 判断前の記録撤去申請を申請者が取り下げる。 */
export function withdrawSystemRecordRetirement(
  context: ConstructorParameters<typeof WithdrawRecordRetirementAdapter>[0],
  ...input: Parameters<WithdrawRecordRetirementAdapter["execute"]>
): ReturnType<WithdrawRecordRetirementAdapter["execute"]> {
  return new WithdrawRecordRetirementAdapter(context).execute(...input)
}
