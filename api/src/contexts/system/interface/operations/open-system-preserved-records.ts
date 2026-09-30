import { PreservedRecordRepository } from "@system/infrastructure/repositories/records/preserved-record.repository"

/** 保全済み本文と確定記録の保存口を開く。 */
export function openSystemPreservedRecords(
  context: ConstructorParameters<typeof PreservedRecordRepository>[0],
): PreservedRecordRepository {
  return new PreservedRecordRepository(context)
}
