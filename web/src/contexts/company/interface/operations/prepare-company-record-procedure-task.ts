import { PrepareCompanyRecordProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-task.adapter"

/** 記録の手続きの task へ、会社上の判断資格を持つ候補を固定する公開境界。 */
export function prepareCompanyRecordProcedureTask(
  c: ConstructorParameters<typeof PrepareCompanyRecordProcedureTaskAdapter>[0],
  input: Parameters<PrepareCompanyRecordProcedureTaskAdapter["prepare"]>[0],
): ReturnType<PrepareCompanyRecordProcedureTaskAdapter["prepare"]> {
  return new PrepareCompanyRecordProcedureTaskAdapter(c).prepare(input)
}
