import { CompanyAccountEmployeeLinksReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-account-employee-links-read.adapter"

/** Account と従業員の対応を会社営業日で読む公開境界。 */
export function readCompanyAccountEmployeeLinks(
  c: ConstructorParameters<typeof CompanyAccountEmployeeLinksReadAdapter>[0],
  ...input: Parameters<CompanyAccountEmployeeLinksReadAdapter["findMany"]>
): ReturnType<CompanyAccountEmployeeLinksReadAdapter["findMany"]> {
  return new CompanyAccountEmployeeLinksReadAdapter(c).findMany(...input)
}
