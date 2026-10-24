import { PrepareRecordSourceFreezeAuthorizationAdapter } from "@system/infrastructure/adapters/records/prepare-record-source-freeze-authorization.adapter"

/** 書込み停止の技術権限を人の現在の認証とstep-upへ束縛し、DB確定時に再検査する文を返す。 */
export function prepareSystemRecordSourceFreezeAuthorization(
  context: ConstructorParameters<typeof PrepareRecordSourceFreezeAuthorizationAdapter>[0],
  ...input: Parameters<PrepareRecordSourceFreezeAuthorizationAdapter["prepare"]>
): ReturnType<PrepareRecordSourceFreezeAuthorizationAdapter["prepare"]> {
  return new PrepareRecordSourceFreezeAuthorizationAdapter(context).prepare(...input)
}
