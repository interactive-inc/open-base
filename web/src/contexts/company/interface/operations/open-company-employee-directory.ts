import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"

/** 業務 context が使う、従業員名簿の読取の口。 */
export type CompanyEmployeeDirectory = Pick<
  CompanyEmployeeDirectoryReadAdapter,
  "findById" | "findByCode" | "findForEmployeeIds" | "findForAccountIds" | "list"
>

/** 指定の暦日または会社営業日の期間履歴で、従業員名簿を読む口を開く公開境界。 */
export function openCompanyEmployeeDirectory(
  c: ConstructorParameters<typeof CompanyEmployeeDirectoryReadAdapter>[0],
): CompanyEmployeeDirectory {
  return new CompanyEmployeeDirectoryReadAdapter(c)
}
