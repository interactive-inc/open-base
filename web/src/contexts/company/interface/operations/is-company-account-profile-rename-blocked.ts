import { CompanyAccountProfileRenameGuardAdapter } from "@/contexts/company/infrastructure/adapters/account-profile/company-account-profile-rename-guard.adapter"

/** 表示名の変更が従業員への接続による保護で止まったかを判定する公開境界。 */
export function isCompanyAccountProfileRenameBlocked(cause: unknown): boolean {
  return CompanyAccountProfileRenameGuardAdapter.isBlocked(cause)
}
