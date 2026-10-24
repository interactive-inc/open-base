import { PreparePreservedRecordRetentionGuardAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-retention-guard.adapter"

/** 承認された本文の保持条件が未解除・有効であることを、照合確定時にも検査する文を返す。 */
export function prepareSystemPreservedRecordRetentionGuard(
  context: ConstructorParameters<typeof PreparePreservedRecordRetentionGuardAdapter>[0],
  ...input: Parameters<PreparePreservedRecordRetentionGuardAdapter["prepare"]>
): ReturnType<PreparePreservedRecordRetentionGuardAdapter["prepare"]> {
  return new PreparePreservedRecordRetentionGuardAdapter(context).prepare(...input)
}
