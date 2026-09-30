import { RecordRetirementVerificationReceiptRepository } from "@system/infrastructure/repositories/records/record-retirement-verification-receipt.repository"

/** 撤去検査の受領記録を照合文付きで読み書きするSystemの保存口を開く。 */
export function openSystemRecordRetirementVerificationReceipts(
  context: ConstructorParameters<typeof RecordRetirementVerificationReceiptRepository>[0],
): RecordRetirementVerificationReceiptRepository {
  return new RecordRetirementVerificationReceiptRepository(context)
}
