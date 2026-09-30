import { CompanyResourceTable } from "@/components/company-resource-table"
import { FetchError } from "@/components/fetch-error"
import { getCompanyAccountEmployeeLinkResources } from "@/lib/api/get-company-account-employee-link-resources"
import { filterResourcesByType } from "@/lib/company/filter-resources-by-type"
import { readResourceText } from "@/lib/company/read-resource-text"

/** Account と Employee の対応を読み取り専用で並べる。 */
export async function CompanyAccountEmployeeLinkSection() {
  const links = await getCompanyAccountEmployeeLinkResources()

  if (links instanceof Error) {
    return <FetchError message="Account の対応の取得に失敗しました" />
  }

  const accountEmployeeLinks = filterResourcesByType(links.resources, "account-employee-link")

  return (
    <CompanyResourceTable
      caption="Account と Employee の対応の一覧"
      resources={accountEmployeeLinks}
      emptyTitle="Account の対応が登録されていません"
      emptyDescription="対応の正本は API と CLI が持ちます。まだ登録がありません。"
      columns={[
        {
          header: "Account",
          toValue: (resource) => readResourceText(resource, "accountId") ?? "-",
        },
        {
          header: "Employee",
          toValue: (resource) => readResourceText(resource, "employeeId") ?? "-",
        },
      ]}
    />
  )
}
