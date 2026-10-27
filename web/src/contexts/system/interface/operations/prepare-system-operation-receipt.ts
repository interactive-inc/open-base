import type { SystemOperationReceiptEntity } from "@system/domain/entities/system-operation-receipt.entity"
import { SystemOperationReceiptRepository } from "@system/infrastructure/repositories/events/system-operation-receipt.repository"

/** 製品の変更と同じtransactionに保存するSystem操作完了文を作る。 */
export function prepareSystemOperationReceipt(
  database: D1Database,
  receipt: SystemOperationReceiptEntity,
) {
  return new SystemOperationReceiptRepository({ env: { DB: database } }).prepare(receipt)
}
