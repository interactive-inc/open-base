import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"

/** 原記録の書込み停止世代を読み書きするSystemの保存口を開く。 */
export function openSystemRecordSourceFreezes(
  context: ConstructorParameters<typeof RecordSourceFreezeRepository>[0],
): RecordSourceFreezeRepository {
  return new RecordSourceFreezeRepository(context)
}
