import { sql } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import { drizzle } from "drizzle-orm/d1"

type Context = Readonly<{
  database: D1Database
  organizationId: string
  expectedRevision: number
}>

/** SELECT が必ず一行を返し、組織不在も含む版不一致で batch を中断する。 */
export class CompanyRevisionGuardAdapter {
  constructor(private readonly c: Context) {}

  prepare(): BatchItem<"sqlite"> {
    return drizzle(this.c.database)
      .select({
        revisionGuard: sql<number>`CASE WHEN
        (SELECT revision FROM company_organizations WHERE id = ${this.c.organizationId})
          = ${this.c.expectedRevision}
        THEN 0 ELSE json_extract('[]', 'company_revision_conflict') END`,
      })
      .from(sql`(SELECT 1) AS company_revision_guard`)
  }
}
