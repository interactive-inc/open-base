import { PrepareRecordKindCoverageAdapter } from "@system/infrastructure/adapters/records/prepare-record-kind-coverage.adapter"

/** 一つの記録種別の照合が先頭から終端まで連続することを検査する。本文・添付の再検証や撤去許可は行わない。 */
export function prepareSystemRecordKindCoverage(
  context: ConstructorParameters<typeof PrepareRecordKindCoverageAdapter>[0],
  ...input: Parameters<PrepareRecordKindCoverageAdapter["prepare"]>
): ReturnType<PrepareRecordKindCoverageAdapter["prepare"]> {
  return new PrepareRecordKindCoverageAdapter(context).prepare(...input)
}
