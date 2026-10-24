import { PrepareRecordRetirementRetentionAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-retention.adapter"

/** 全検査ページの保全先について元の承認済み保持を再検査する。原記録や開示資格の検査は行わない。 */
export function prepareSystemRecordRetirementRetention(
  context: ConstructorParameters<typeof PrepareRecordRetirementRetentionAdapter>[0],
  ...input: Parameters<PrepareRecordRetirementRetentionAdapter["prepare"]>
): ReturnType<PrepareRecordRetirementRetentionAdapter["prepare"]> {
  return new PrepareRecordRetirementRetentionAdapter(context).prepare(...input)
}
