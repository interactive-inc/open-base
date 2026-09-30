import { CompanyAccountDisplayNameProjectionAdapter } from "@/contexts/company/infrastructure/adapters/account-profile/company-account-display-name-projection.adapter"

/** Account の表示名を会社の正本から読む式を作る公開境界。 */
export function projectCompanyAccountDisplayName(
  c: ConstructorParameters<typeof CompanyAccountDisplayNameProjectionAdapter>[0],
  ...input: Parameters<CompanyAccountDisplayNameProjectionAdapter["project"]>
): ReturnType<CompanyAccountDisplayNameProjectionAdapter["project"]> {
  return new CompanyAccountDisplayNameProjectionAdapter(c).project(...input)
}
