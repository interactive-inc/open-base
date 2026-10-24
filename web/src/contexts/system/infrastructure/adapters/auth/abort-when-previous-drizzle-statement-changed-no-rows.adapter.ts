import type { SystemDatabase } from "@system/configuration/system-context"
import { sql } from "drizzle-orm"
type AbortWhenPreviousDrizzleStatementChangedNoRowsAdapterContext = SystemDatabase
type Context = AbortWhenPreviousDrizzleStatementChangedNoRowsAdapterContext

/** 直前のDrizzle mutationが0行ならD1 batchをrollbackさせるguard query。 */
export class AbortWhenPreviousDrizzleStatementChangedNoRowsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  abortWhenPreviousDrizzleStatementChangedNoRows() {
    return this.c
      .select({
        ok: sql<number>`CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END`,
      })
      .from(sql`(SELECT 1)`)
  }
}
