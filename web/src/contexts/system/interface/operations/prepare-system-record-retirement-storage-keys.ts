import { PrepareRecordRetirementStorageKeysAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-storage-keys.adapter"

/** ページ検査時に使った鍵が現在も同じ設定で存在することを確認する。 */
export function prepareSystemRecordRetirementStorageKeys(
  context: ConstructorParameters<typeof PrepareRecordRetirementStorageKeysAdapter>[0],
  ...input: Parameters<PrepareRecordRetirementStorageKeysAdapter["prepare"]>
): ReturnType<PrepareRecordRetirementStorageKeysAdapter["prepare"]> {
  return new PrepareRecordRetirementStorageKeysAdapter(context).prepare(...input)
}
