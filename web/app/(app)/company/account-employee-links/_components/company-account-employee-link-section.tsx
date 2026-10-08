import { CompanyResourceTable } from "@/components/company-resource-table"
import { FetchError } from "@/components/fetch-error"
import { getCompanyAccountEmployeeLinkResources } from "@/lib/api/get-company-account-employee-link-resources"
import { filterResourcesByType } from "@/lib/company/filter-resources-by-type"
import { readResourceText } from "@/lib/company/read-resource-text"

/** Account と Employee の対応を読み取り専用で並べる。 */
export async function CompanyAccountEmployeeLinkSection() {
  const links = await getCompanyAccountEmployeeLinkResources()

  if (links instanceof Error) {
    return <FetchError message="アカウントの紐付けを読み込めませんでした。" />
  }

  const accountEmployeeLinks = filterResourcesByType(links.resources, "account-employee-link")

  return (
    <CompanyResourceTable
      caption="アカウントの紐付けの一覧"
      resources={accountEmployeeLinks}
      emptyTitle="アカウントの紐付けが登録されていません"
      emptyDescription="紐付けは API または CLI で登録します。"
      columns={[
        {
          header: "アカウント",
          toValue: (resource) => readResourceText(resource, "accountId") ?? "-",
        },
        {
          header: "従業員",
          toValue: (resource) => readResourceText(resource, "employeeId") ?? "-",
        },
      ]}
    />
  )
}
