import { RecordSourceRetirementRepository } from "@system/infrastructure/repositories/records/record-source-retirement.repository"

/** 原記録の撤去確定を照合文付きで読み書きするSystemの保存口を開く。 */
export function openSystemRecordSourceRetirements(
  context: ConstructorParameters<typeof RecordSourceRetirementRepository>[0],
): RecordSourceRetirementRepository {
  return new RecordSourceRetirementRepository(context)
}
