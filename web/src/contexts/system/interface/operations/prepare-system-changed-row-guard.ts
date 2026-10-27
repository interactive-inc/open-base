import type { SystemDatabase } from "@system/configuration/system-context"
import { AbortWhenPreviousDrizzleStatementChangedNoRowsAdapter } from "@system/infrastructure/adapters/auth/abort-when-previous-drizzle-statement-changed-no-rows.adapter"

/** 直前の更新が0行なら、同じbatchを取り消す文を返す。 */
export function prepareSystemChangedRowGuard(database: SystemDatabase) {
  return new AbortWhenPreviousDrizzleStatementChangedNoRowsAdapter(
    database,
  ).abortWhenPreviousDrizzleStatementChangedNoRows()
}
