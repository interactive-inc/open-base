import { CompanyAccountProfileEntity } from "@/contexts/company/domain/entities/company-account-profile.entity"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

/** Account の更新と同じ D1 batch へ載せる、表示名を Account 名へ揃える文を返す公開境界。 */
export function prepareCompanyAccountProfileRename(
  database: D1Database,
  input: Readonly<{ accountId: string; name: string; now: Date }>,
): D1PreparedStatement {
  const displayName = CompanyAccountProfileEntity.displayNameFromAccount(
    input.name,
    null,
    input.accountId,
  )
  const timestamp = input.now.getTime()

  return database
    .prepare(
      `INSERT INTO company_account_profiles (
         organization_id, account_id, display_name, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?4)
       ON CONFLICT (organization_id, account_id)
       DO UPDATE SET display_name = ?3, updated_at = ?4`,
    )
    .bind(COMPANY_DEFAULT_ORGANIZATION_ID, input.accountId, displayName, timestamp)
}
