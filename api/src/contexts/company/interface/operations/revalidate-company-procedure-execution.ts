import { RevalidateCompanyProcedureExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-execution.adapter"

/** 手続きの実行直前に、会社上の資格を再検査する文を返す公開境界。 */
export function revalidateCompanyProcedureExecution(
  c: ConstructorParameters<typeof RevalidateCompanyProcedureExecutionAdapter>[0],
  input: Parameters<RevalidateCompanyProcedureExecutionAdapter["prepare"]>[0],
): ReturnType<RevalidateCompanyProcedureExecutionAdapter["prepare"]> {
  return new RevalidateCompanyProcedureExecutionAdapter(c).prepare(input)
}
