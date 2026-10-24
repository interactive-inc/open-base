import { CompanyResourceTable } from "@/components/company-resource-table"
import { FetchError } from "@/components/fetch-error"
import { getCompanyPeopleResources } from "@/lib/api/get-company-people-resources"
import { filterResourcesByType } from "@/lib/company/filter-resources-by-type"
import { readResourceText } from "@/lib/company/read-resource-text"

/** Person を読み取り専用で並べる。 */
export async function CompanyPeopleSection() {
  const people = await getCompanyPeopleResources()

  if (people instanceof Error) {
    return <FetchError message="人物を読み込めませんでした。" />
  }

  const persons = filterResourcesByType(people.resources, "person")

  return (
    <CompanyResourceTable
      caption="人物の一覧"
      resources={persons}
      emptyTitle="人物が登録されていません"
      emptyDescription="API または CLI で登録します。"
      columns={[
        {
          header: "氏名",
          toValue: (resource) => readResourceText(resource, "officialName") ?? "-",
        },
        {
          header: "メールアドレス",
          toValue: (resource) => readResourceText(resource, "email") ?? "-",
        },
        { header: "電話番号", toValue: (resource) => readResourceText(resource, "phone") ?? "-" },
        { header: "ID", toValue: (resource) => resource.id },
      ]}
    />
  )
}
