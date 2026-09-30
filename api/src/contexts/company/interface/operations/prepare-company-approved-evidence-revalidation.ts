import { RevalidateCompanyProcedureExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-execution.adapter"

/** 承認済みの証跡の実行直前に、会社上の資格を再検査する文を返す公開境界。 */
export function prepareCompanyApprovedEvidenceRevalidation(
  c: ConstructorParameters<typeof RevalidateCompanyProcedureExecutionAdapter>[0],
  input: Parameters<RevalidateCompanyProcedureExecutionAdapter["prepareApprovedEvidence"]>[0],
): ReturnType<RevalidateCompanyProcedureExecutionAdapter["prepareApprovedEvidence"]> {
  return new RevalidateCompanyProcedureExecutionAdapter(c).prepareApprovedEvidence(input)
}
