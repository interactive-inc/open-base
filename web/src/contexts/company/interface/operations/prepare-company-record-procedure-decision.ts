import { PrepareCompanyRecordProcedureDecisionAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-decision.adapter"

/** 記録の手続きを判断する人の Account 対応と会社上の資格を固定する公開境界。 */
export function prepareCompanyRecordProcedureDecision(
  c: ConstructorParameters<typeof PrepareCompanyRecordProcedureDecisionAdapter>[0],
  input: Parameters<PrepareCompanyRecordProcedureDecisionAdapter["prepare"]>[0],
): ReturnType<PrepareCompanyRecordProcedureDecisionAdapter["prepare"]> {
  return new PrepareCompanyRecordProcedureDecisionAdapter(c).prepare(input)
}
