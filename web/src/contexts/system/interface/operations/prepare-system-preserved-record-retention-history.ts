import { PreparePreservedRecordRetentionHistoryAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-retention-history.adapter"

/** 同じ原文への全保全・解除を取得し、取得中の追加や解除を最終transactionで検知する。 */
export function prepareSystemPreservedRecordRetentionHistory(
  context: ConstructorParameters<typeof PreparePreservedRecordRetentionHistoryAdapter>[0],
  ...input: Parameters<PreparePreservedRecordRetentionHistoryAdapter["prepare"]>
): ReturnType<PreparePreservedRecordRetentionHistoryAdapter["prepare"]> {
  return new PreparePreservedRecordRetentionHistoryAdapter(context).prepare(...input)
}
