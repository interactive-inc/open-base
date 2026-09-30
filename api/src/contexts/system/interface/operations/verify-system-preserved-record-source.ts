import { VerifyPreservedRecordSourceAdapter } from "@system/infrastructure/adapters/records/verify-preserved-record-source.adapter"

/** 現在の開示資格で保全本文を復号・監査し、期待する原記録の内容と来歴を照合する。 */
export function verifySystemPreservedRecordSource(
  context: ConstructorParameters<typeof VerifyPreservedRecordSourceAdapter>[0],
  ...input: Parameters<VerifyPreservedRecordSourceAdapter["execute"]>
): ReturnType<VerifyPreservedRecordSourceAdapter["execute"]> {
  return new VerifyPreservedRecordSourceAdapter(context).execute(...input)
}
