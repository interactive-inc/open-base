import { PrepareRecordRetirementDisclosureAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-disclosure.adapter"

/** 撤去計画内の全記録を現在のAccountが同じ目的で読めることを検査する。本文取得と保持検査は行わない。 */
export function prepareSystemRecordRetirementDisclosure(
  context: ConstructorParameters<typeof PrepareRecordRetirementDisclosureAdapter>[0],
  ...input: Parameters<PrepareRecordRetirementDisclosureAdapter["prepare"]>
): ReturnType<PrepareRecordRetirementDisclosureAdapter["prepare"]> {
  return new PrepareRecordRetirementDisclosureAdapter(context).prepare(...input)
}
