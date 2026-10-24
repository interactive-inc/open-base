import { CompanyAccountDisplayNameProjectionAdapter } from "@/contexts/company/infrastructure/adapters/account-profile/company-account-display-name-projection.adapter"
import { companyAccountProfiles } from "@/contexts/company/infrastructure/schema/company"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { and, eq, sql } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

export type CompanyAccountProfile = Readonly<{
  /** 会社の正本から解決した表示名。projection を渡さないとき、または解決できなければ null。 */
  name: string | null
  /** Account に保存している表示名。改名の対象はこの値。 */
  storedDisplayName: string
  updatedAt: number
}>

/** 既定の組織での Account の表示名を読む公開境界。行が無ければ undefined。 */
export async function readCompanyAccountProfile(
  input: Readonly<{
    database: Pick<DrizzleD1Database, "select">
    accountId: AccountId
    /** 表示名を会社の正本から解決する時点。保存値だけが要るときは渡さない。 */
    projection?: Readonly<{ now: Date; timeZone: string | undefined }>
  }>,
): Promise<CompanyAccountProfile | undefined> {
  const [row] = await input.database
    .select({
      name:
        input.projection === undefined
          ? sql<string | null>`NULL`
          : new CompanyAccountDisplayNameProjectionAdapter(input.projection).project(
              companyAccountProfiles,
            ),
      storedDisplayName: companyAccountProfiles.displayName,
      updatedAt: companyAccountProfiles.updatedAt,
    })
    .from(companyAccountProfiles)
    .where(
      and(
        eq(companyAccountProfiles.organizationId, COMPANY_DEFAULT_ORGANIZATION_ID),
        eq(companyAccountProfiles.accountId, input.accountId),
      ),
    )
    .limit(1)

  return row
}
