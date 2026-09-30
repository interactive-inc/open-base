import { sql } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"

type Context = Pick<DrizzleD1Database, "select">
const BLOCKED_PATH = "company_account_name_managed_by_employee"

/** 従業員が氏名を所有するAccountへの直接改名を、保存するtransaction内で拒否する。 */
export class CompanyAccountProfileRenameGuardAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  build(accountId: string) {
    return this.c
      .select({
        ok: sql<number>`CASE WHEN EXISTS (
        SELECT 1 FROM company_account_employee_resource_bindings
        WHERE account_id = ${accountId}
      ) THEN json_extract('{}', ${BLOCKED_PATH}) ELSE 1 END`,
      })
      .from(sql`(SELECT 1)`)
  }

  static isBlocked(cause: unknown): boolean {
    const visited = new Set<Error>()
    for (let error = cause; error instanceof Error && !visited.has(error); error = error.cause) {
      if (
        /(?:bad JSON path:|JSON path error near)\s*['"]company_account_name_managed_by_employee['"]/i.test(
          error.message,
        )
      )
        return true
      visited.add(error)
    }
    return false
  }
}
