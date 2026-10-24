import { CompanyAccountProfileEntity } from "@/contexts/company/domain/entities/company-account-profile.entity"
import { companyAccountProfiles } from "@/contexts/company/infrastructure/schema/company"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

/**
 * Account の発行と同じ batch へ載せる、会社上の表示名を作る文を返す公開境界。
 * login の identity 解決がこの表を必要とするため、Account を作る経路は必ずこの文を同じ batch に含める。
 * 既存行があれば表示名だけを Account 名へ揃える。
 */
export function buildCompanyAccountProfileUpsert(
  database: Pick<DrizzleD1Database, "insert">,
  input: Readonly<{ accountId: string; name: string; email: string | null; now: Date }>,
) {
  const accountId = zAccountId.parse(input.accountId)
  const displayName = CompanyAccountProfileEntity.displayNameFromAccount(
    input.name,
    input.email,
    input.accountId,
  )
  const timestamp = input.now.getTime()

  return database
    .insert(companyAccountProfiles)
    .values({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      accountId,
      displayName,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: [companyAccountProfiles.organizationId, companyAccountProfiles.accountId],
      set: { displayName, updatedAt: timestamp },
    })
}
