import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1"
import { sql } from "drizzle-orm"

/** 旧従業員行を公開履歴の代わりに読まず、未接続を明示的な読取失敗にする。 */
export async function assertPublicEmployeeBindings(
  source: D1Database | Pick<DrizzleD1Database, "select">,
): Promise<Error | null> {
  try {
    const database = "prepare" in source ? drizzle(source) : source
    const rows = await database
      .select({ present: sql<number>`1` })
      .from(sql`company_employees AS employee`)
      .where(sql`NOT EXISTS (
        SELECT 1 FROM company_workforce_resource_bindings AS binding
        WHERE binding.resource_type = 'employee' AND binding.employee_id = employee.id
      )`)
      .limit(1)
    if (rows.length !== 0) return new Error("Company employee public binding is incomplete")
    return null
  } catch (cause) {
    return new Error("failed to verify Company employee public bindings", { cause })
  }
}
