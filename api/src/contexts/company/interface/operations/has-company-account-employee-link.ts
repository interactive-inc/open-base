import { accountEmployeeLinks } from "@/contexts/company/infrastructure/schema/employee"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"

/**
 * Account が従業員台帳に一度でも紐付いたかを読む公開境界。
 * 対応期間が終わっても氏名の所有者は変わらないので、期間は問わない。
 */
export async function hasCompanyAccountEmployeeLink(
  input: Readonly<{ database: Pick<DrizzleD1Database, "select">; accountId: AccountId }>,
): Promise<boolean> {
  const [link] = await input.database
    .select({ accountId: accountEmployeeLinks.accountId })
    .from(accountEmployeeLinks)
    .where(eq(accountEmployeeLinks.accountId, input.accountId))
    .limit(1)

  return link !== undefined
}
