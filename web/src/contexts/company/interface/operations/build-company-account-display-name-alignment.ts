import { AlignAccountDisplayNameToEmployeeAdapter } from "@/contexts/company/infrastructure/adapters/account-profile/align-account-display-name-to-employee.adapter"

/** Account の表示名を従業員の氏名へ揃える文を作る公開境界。 */
export function buildCompanyAccountDisplayNameAlignment(
  c: ConstructorParameters<typeof AlignAccountDisplayNameToEmployeeAdapter>[0],
  ...input: Parameters<AlignAccountDisplayNameToEmployeeAdapter["buildAlignment"]>
): ReturnType<AlignAccountDisplayNameToEmployeeAdapter["buildAlignment"]> {
  return new AlignAccountDisplayNameToEmployeeAdapter(c).buildAlignment(...input)
}
