import { SystemD1ProcedureDelegationAdapter } from "@system/infrastructure/adapters/workflow/system-d1-procedure-delegation.adapter"

/** Procedure scope付きSystem Delegationを作成・一覧・取消する口を開く。 */
export function openSystemProcedureDelegations(
  context: ConstructorParameters<typeof SystemD1ProcedureDelegationAdapter>[0],
): SystemD1ProcedureDelegationAdapter {
  return new SystemD1ProcedureDelegationAdapter(context)
}
