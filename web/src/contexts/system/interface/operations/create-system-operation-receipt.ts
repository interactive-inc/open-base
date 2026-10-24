import { SystemOperationReceiptEntity } from "@system/domain/entities/system-operation-receipt.entity"

/** Systemが所有する値を検証・生成する。 */
export function createSystemOperationReceipt(
  ...input: Parameters<typeof SystemOperationReceiptEntity.create>
) {
  return SystemOperationReceiptEntity.create(...input)
}
