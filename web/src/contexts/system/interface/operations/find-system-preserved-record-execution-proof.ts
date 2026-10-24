import { FindPreservedRecordExecutionProofAdapter } from "@system/infrastructure/adapters/records/find-preserved-record-execution-proof.adapter"

/** 当初の保全条件と一意の実行済み案件を読み、消費済み許可・提案版との対応を検証する。 */
export function findSystemPreservedRecordExecutionProof(
  context: ConstructorParameters<typeof FindPreservedRecordExecutionProofAdapter>[0],
  ...input: Parameters<FindPreservedRecordExecutionProofAdapter["find"]>
): ReturnType<FindPreservedRecordExecutionProofAdapter["find"]> {
  return new FindPreservedRecordExecutionProofAdapter(context).find(...input)
}
