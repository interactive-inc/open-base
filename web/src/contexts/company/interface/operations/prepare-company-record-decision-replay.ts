import { PrepareCompanyRecordDecisionReplayAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-decision-replay.adapter"

/** 記録の判断の再送を、判断時の会社上の資格と照合する公開境界。 */
export function prepareCompanyRecordDecisionReplay(
  c: ConstructorParameters<typeof PrepareCompanyRecordDecisionReplayAdapter>[0],
  input: Parameters<PrepareCompanyRecordDecisionReplayAdapter["prepare"]>[0],
): ReturnType<PrepareCompanyRecordDecisionReplayAdapter["prepare"]> {
  return new PrepareCompanyRecordDecisionReplayAdapter(c).prepare(input)
}
