import { VerifyPreservedRecordContentAdapter } from "@system/infrastructure/adapters/records/verify-preserved-record-content.adapter"

/** 暗号化された保全本文を読み戻し、原記録と取得情報の一致を検証する。 */
export function verifySystemPreservedRecordContent(
  context: ConstructorParameters<typeof VerifyPreservedRecordContentAdapter>[0],
  ...input: Parameters<VerifyPreservedRecordContentAdapter["execute"]>
): ReturnType<VerifyPreservedRecordContentAdapter["execute"]> {
  return new VerifyPreservedRecordContentAdapter(context).execute(...input)
}
