import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"

/**
 * 会社営業日の氏名、在籍状態、雇用区分を 1 文につき 1 回だけ計算する派生表を返す公開境界。
 * 使い方と fail closed の規則は CompanyEmployeeDirectoryReadAdapter.employmentStateTable に従う。
 */
export function companyEmploymentStateTable(
  c: Parameters<typeof CompanyEmployeeDirectoryReadAdapter.employmentStateTable>[0],
): ReturnType<typeof CompanyEmployeeDirectoryReadAdapter.employmentStateTable> {
  return CompanyEmployeeDirectoryReadAdapter.employmentStateTable(c)
}
