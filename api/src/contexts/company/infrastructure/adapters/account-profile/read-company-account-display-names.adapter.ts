import { CompanyAccountDisplayNameProjectionAdapter } from "@/contexts/company/infrastructure/adapters/account-profile/company-account-display-name-projection.adapter"
import { companyAccountProfiles } from "@/contexts/company/infrastructure/schema/company"
import { and, asc, inArray, sql } from "drizzle-orm"
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1"
import { z } from "zod"

type Context = Readonly<{
  database: D1Database | Pick<DrizzleD1Database, "select">
  organizationIds: ReadonlyArray<string>
  accountIds: ReadonlyArray<string>
  now: string
  timeZone: string | undefined
}>

/** 参照可能な会社の表示名を同一時点で読み、複数会社ではorganization ID順に選ぶ。 */
export class ReadCompanyAccountDisplayNamesAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async readCompanyAccountDisplayNames(): Promise<ReadonlyMap<string, string>> {
    if (this.c.accountIds.length === 0 || this.c.organizationIds.length === 0) return new Map()
    const database = "prepare" in this.c.database ? drizzle(this.c.database) : this.c.database
    const names = await database
      .select({
        accountId: companyAccountProfiles.accountId,
        displayName: new CompanyAccountDisplayNameProjectionAdapter({
          now: new Date(this.c.now),
          timeZone: this.c.timeZone,
        }).project(companyAccountProfiles),
      })
      .from(companyAccountProfiles)
      .where(
        and(
          inArray(
            companyAccountProfiles.accountId,
            sql`(SELECT value FROM json_each(${JSON.stringify([...new Set(this.c.accountIds)])}))`,
          ),
          this.c.organizationIds.includes("*")
            ? undefined
            : inArray(
                companyAccountProfiles.organizationId,
                sql`(SELECT value FROM json_each(${JSON.stringify([...new Set(this.c.organizationIds)])}))`,
              ),
        ),
      )
      .orderBy(asc(companyAccountProfiles.organizationId), asc(companyAccountProfiles.accountId))
    const result = new Map<string, string>()
    for (const name of z
      .array(z.object({ accountId: z.string().min(1), displayName: z.string().min(1).nullable() }))
      .parse(names)) {
      if (name.displayName !== null && !result.has(name.accountId))
        result.set(name.accountId, name.displayName)
    }
    return result
  }
}
