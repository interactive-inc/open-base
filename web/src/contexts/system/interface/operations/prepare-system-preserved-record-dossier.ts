import { PreparePreservedRecordDossierAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-dossier.adapter"

/** 原記録の確定根拠・承認・保持・開示履歴・参照先監査を揃え、最終開示前の検査を返す。 */
export function prepareSystemPreservedRecordDossier(
  context: ConstructorParameters<typeof PreparePreservedRecordDossierAdapter>[0],
  ...input: Parameters<PreparePreservedRecordDossierAdapter["prepare"]>
): ReturnType<PreparePreservedRecordDossierAdapter["prepare"]> {
  return new PreparePreservedRecordDossierAdapter(context).prepare(...input)
}
