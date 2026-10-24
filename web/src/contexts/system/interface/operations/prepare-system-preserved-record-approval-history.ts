import { PreparePreservedRecordApprovalHistoryAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-approval-history.adapter"

/** 確定した提案版の履歴と、応答直前に使う検査を準備する。 */
export function prepareSystemPreservedRecordApprovalHistory(
  context: ConstructorParameters<typeof PreparePreservedRecordApprovalHistoryAdapter>[0],
  ...input: Parameters<PreparePreservedRecordApprovalHistoryAdapter["prepare"]>
): ReturnType<PreparePreservedRecordApprovalHistoryAdapter["prepare"]> {
  return new PreparePreservedRecordApprovalHistoryAdapter(context).prepare(...input)
}
