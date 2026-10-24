import { RevalidateRecordPreservationExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-record-preservation-execution.adapter"

/** 記録の保全の実行直前に、会社上の資格を再検査する文を返す公開境界。 */
export function revalidateCompanyRecordPreservationExecution(
  c: ConstructorParameters<typeof RevalidateRecordPreservationExecutionAdapter>[0],
  input: Parameters<RevalidateRecordPreservationExecutionAdapter["prepare"]>[0],
): ReturnType<RevalidateRecordPreservationExecutionAdapter["prepare"]> {
  return new RevalidateRecordPreservationExecutionAdapter(c).prepare(input)
}
