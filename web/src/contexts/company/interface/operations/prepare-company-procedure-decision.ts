import { PrepareCompanyProcedureDecisionAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-procedure-decision.adapter"

/** 手続きの判断者の会社上の資格を固定する公開境界。 */
export function prepareCompanyProcedureDecision(
  c: ConstructorParameters<typeof PrepareCompanyProcedureDecisionAdapter>[0],
  ...input: Parameters<PrepareCompanyProcedureDecisionAdapter["prepare"]>
): ReturnType<PrepareCompanyProcedureDecisionAdapter["prepare"]> {
  return new PrepareCompanyProcedureDecisionAdapter(c).prepare(...input)
}
