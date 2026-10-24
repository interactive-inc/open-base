import { CompanyAccountProfileRenameGuardAdapter } from "@/contexts/company/infrastructure/adapters/account-profile/company-account-profile-rename-guard.adapter"

/** 従業員に接続した Account の表示名を直接変更させない保護文を作る公開境界。 */
export function buildCompanyAccountProfileRenameGuard(
  c: ConstructorParameters<typeof CompanyAccountProfileRenameGuardAdapter>[0],
  ...input: Parameters<CompanyAccountProfileRenameGuardAdapter["build"]>
): ReturnType<CompanyAccountProfileRenameGuardAdapter["build"]> {
  return new CompanyAccountProfileRenameGuardAdapter(c).build(...input)
}
