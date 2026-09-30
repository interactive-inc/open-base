import { CompanyResourceTable } from "@/components/company-resource-table"
import { FetchError } from "@/components/fetch-error"
import { getCompanyDefinitionResources } from "@/lib/api/get-company-definition-resources"
import { filterResourcesByType } from "@/lib/company/filter-resources-by-type"
import { readResourceText } from "@/lib/company/read-resource-text"

const emptyDescription = "会社の正本は API と CLI が持ちます。まだ登録がありません。"

/** 事業所（Site）と勤務場所（Workplace）を読み取り専用で並べる。 */
export async function CompanySiteSection() {
  const definitions = await getCompanyDefinitionResources()

  if (definitions instanceof Error) {
    return <FetchError message="事業所と勤務場所の取得に失敗しました" />
  }

  const sites = filterResourcesByType(definitions.resources, "site")

  const workplaces = filterResourcesByType(definitions.resources, "workplace")

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">事業所</h2>

        <CompanyResourceTable
          caption="事業所の一覧"
          resources={sites}
          emptyTitle="事業所が登録されていません"
          emptyDescription={emptyDescription}
          columns={[
            { header: "コード", toValue: (resource) => readResourceText(resource, "code") ?? "-" },
            {
              header: "正式名称",
              toValue: (resource) => readResourceText(resource, "officialName") ?? "-",
            },
            { header: "区分", toValue: (resource) => readResourceText(resource, "kind") ?? "-" },
            {
              header: "国",
              toValue: (resource) => readResourceText(resource, "countryCode") ?? "-",
            },
            {
              header: "タイムゾーン",
              toValue: (resource) => readResourceText(resource, "timeZone") ?? "-",
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">勤務場所</h2>

        <CompanyResourceTable
          caption="勤務場所の一覧"
          resources={workplaces}
          emptyTitle="勤務場所が登録されていません"
          emptyDescription={emptyDescription}
          columns={[
            { header: "コード", toValue: (resource) => readResourceText(resource, "code") ?? "-" },
            {
              header: "正式名称",
              toValue: (resource) => readResourceText(resource, "officialName") ?? "-",
            },
            { header: "区分", toValue: (resource) => readResourceText(resource, "kind") ?? "-" },
            {
              header: "事業所",
              toValue: (resource) => readResourceText(resource, "siteId") ?? "-",
            },
          ]}
        />
      </section>
    </div>
  )
}
