import {
  SystemOperationReceiptRepository,
  type SystemOperationReceiptKey,
} from "@system/infrastructure/repositories/events/system-operation-receipt.repository"

/** 再実行を判定するSystemの操作完了記録を読む。 */
export function findSystemOperationReceipt(
  database: D1Database,
  key: SystemOperationReceiptKey,
  assertions: ReadonlyArray<D1PreparedStatement> = [],
) {
  return new SystemOperationReceiptRepository({ env: { DB: database } }).find(key, assertions)
}
