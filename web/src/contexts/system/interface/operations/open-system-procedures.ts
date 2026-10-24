import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"

/** System手続の版とlifecycleを読み書きする保存口を開く。 */
export function openSystemProcedures(
  context: ConstructorParameters<typeof SystemD1ProcedureRepository>[0],
): SystemD1ProcedureRepository {
  return new SystemD1ProcedureRepository(context)
}
