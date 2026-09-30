import { PrepareRecordRetirementPageKeysAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-page-keys.adapter"

/** 撤去検査ページの保全本文と元添付に使う鍵の版を固定し、その設定のdigestを返す。 */
export function prepareSystemRecordRetirementPageKeys(
  context: ConstructorParameters<typeof PrepareRecordRetirementPageKeysAdapter>[0],
  ...input: Parameters<PrepareRecordRetirementPageKeysAdapter["prepare"]>
): ReturnType<PrepareRecordRetirementPageKeysAdapter["prepare"]> {
  return new PrepareRecordRetirementPageKeysAdapter(context).prepare(...input)
}
