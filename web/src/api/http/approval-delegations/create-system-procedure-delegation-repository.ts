import type { Context } from "@/env"
import { openSystemProcedureDelegations } from "@system/interface/operations/open-system-procedure-delegations"

/** Systemの委任永続化を製品API compositionへ接続する。 */
export function createSystemProcedureDelegationRepository(context: Context) {
  return openSystemProcedureDelegations({ env: { DB: context.env.DB } })
}
