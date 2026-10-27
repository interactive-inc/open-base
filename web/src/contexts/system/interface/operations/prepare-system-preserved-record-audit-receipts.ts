import { PreparePreservedRecordAuditReceiptsAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-audit-receipts.adapter"

/** 保全・保持・開示版が参照する監査を全件要求し、欠損や非開示を完全な出力へ混ぜない。 */
export function prepareSystemPreservedRecordAuditReceipts(
  context: ConstructorParameters<typeof PreparePreservedRecordAuditReceiptsAdapter>[0],
  ...input: Parameters<PreparePreservedRecordAuditReceiptsAdapter["prepare"]>
): ReturnType<PreparePreservedRecordAuditReceiptsAdapter["prepare"]> {
  return new PreparePreservedRecordAuditReceiptsAdapter(context).prepare(...input)
}
