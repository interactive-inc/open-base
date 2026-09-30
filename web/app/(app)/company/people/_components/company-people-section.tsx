import { CompanyResourceTable } from "@/components/company-resource-table"
import { FetchError } from "@/components/fetch-error"
import { getCompanyPeopleResources } from "@/lib/api/get-company-people-resources"
import { filterResourcesByType } from "@/lib/company/filter-resources-by-type"
import { readResourceText } from "@/lib/company/read-resource-text"

/** Person を読み取り専用で並べる。 */
export async function CompanyPeopleSection() {
  const people = await getCompanyPeopleResources()

  if (people instanceof Error) {
    return <FetchError message="人の取得に失敗しました" />
  }

  const persons = filterResourcesByType(people.resources, "person")

  return (
    <CompanyResourceTable
      caption="人の一覧"
      resources={persons}
      emptyTitle="人が登録されていません"
      emptyDescription="Person の正本は API と CLI が持ちます。まだ登録がありません。"
      columns={[
        {
          header: "正式氏名",
          toValue: (resource) => readResourceText(resource, "officialName") ?? "-",
        },
        { header: "メール", toValue: (resource) => readResourceText(resource, "email") ?? "-" },
        { header: "電話", toValue: (resource) => readResourceText(resource, "phone") ?? "-" },
        { header: "識別子", toValue: (resource) => resource.id },
      ]}
    />
  )
}
