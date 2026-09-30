import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"

/** 承認済みの記録保全を原記録の再検査後に一回だけ確定する。 */
export function executeSystemRecordPreservation(
  context: ConstructorParameters<typeof ExecuteRecordPreservationAdapter>[0],
  ...input: Parameters<ExecuteRecordPreservationAdapter["execute"]>
): ReturnType<ExecuteRecordPreservationAdapter["execute"]> {
  return new ExecuteRecordPreservationAdapter(context).execute(...input)
}
