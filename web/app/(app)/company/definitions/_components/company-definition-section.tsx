import { CompanyResourceTable } from "@/components/company-resource-table"
import { FetchError } from "@/components/fetch-error"
import { getCompanyDefinitionResources } from "@/lib/api/get-company-definition-resources"
import { filterResourcesByType } from "@/lib/company/filter-resources-by-type"
import { readResourceNumber } from "@/lib/company/read-resource-number"
import { readResourceText } from "@/lib/company/read-resource-text"
import { toAuthorityScopeLabel } from "@/app/(app)/company/definitions/_lib/to-authority-scope-label"

const emptyDescription = "定義の正本は API と CLI が持ちます。まだ登録がありません。"

/** 職務・組織上の役職・責任・権限範囲・合議体の定義を読み取り専用で並べる。 */
export async function CompanyDefinitionSection() {
  const definitions = await getCompanyDefinitionResources()

  if (definitions instanceof Error) {
    return <FetchError message="職務と責任の取得に失敗しました" />
  }

  const jobs = filterResourcesByType(definitions.resources, "job")

  const offices = filterResourcesByType(definitions.resources, "organizational-office")

  const responsibilities = filterResourcesByType(definitions.resources, "responsibility")

  const authorityScopes = filterResourcesByType(definitions.resources, "authority-scope")

  const collectiveBodies = filterResourcesByType(definitions.resources, "collective-body")

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">職務</h2>

        <CompanyResourceTable
          caption="職務の一覧"
          resources={jobs}
          emptyTitle="職務が登録されていません"
          emptyDescription={emptyDescription}
          columns={[
            { header: "コード", toValue: (resource) => readResourceText(resource, "code") ?? "-" },
            {
              header: "正式名称",
              toValue: (resource) => readResourceText(resource, "officialName") ?? "-",
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">組織上の役職</h2>

        <CompanyResourceTable
          caption="組織上の役職の一覧"
          resources={offices}
          emptyTitle="組織上の役職が登録されていません"
          emptyDescription={emptyDescription}
          columns={[
            { header: "コード", toValue: (resource) => readResourceText(resource, "code") ?? "-" },
            {
              header: "正式名称",
              toValue: (resource) => readResourceText(resource, "officialName") ?? "-",
            },
            {
              header: "組織単位",
              toValue: (resource) => readResourceText(resource, "organizationUnitId") ?? "-",
            },
            {
              header: "役職",
              toValue: (resource) => readResourceText(resource, "positionId") ?? "-",
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">責任</h2>

        <CompanyResourceTable
          caption="責任の一覧"
          resources={responsibilities}
          emptyTitle="責任が登録されていません"
          emptyDescription={emptyDescription}
          columns={[
            { header: "コード", toValue: (resource) => readResourceText(resource, "code") ?? "-" },
            {
              header: "正式名称",
              toValue: (resource) => readResourceText(resource, "officialName") ?? "-",
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">権限範囲</h2>

        <CompanyResourceTable
          caption="権限範囲の一覧"
          resources={authorityScopes}
          emptyTitle="権限範囲が登録されていません"
          emptyDescription={emptyDescription}
          columns={[
            {
              header: "種別",
              toValue: (resource) => readResourceText(resource, "scopeType") ?? "-",
            },
            { header: "範囲", toValue: (resource) => toAuthorityScopeLabel(resource) },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">合議体</h2>

        <CompanyResourceTable
          caption="合議体の一覧"
          resources={collectiveBodies}
          emptyTitle="合議体が登録されていません"
          emptyDescription={emptyDescription}
          columns={[
            { header: "コード", toValue: (resource) => readResourceText(resource, "code") ?? "-" },
            {
              header: "正式名称",
              toValue: (resource) => readResourceText(resource, "officialName") ?? "-",
            },
            {
              header: "定足数",
              toValue: (resource) => {
                const quorumValue = readResourceNumber(resource, "quorumValue")

                if (quorumValue === null) return "-"

                const quorumType = readResourceText(resource, "quorumType")

                if (quorumType === "percentage") return `${quorumValue}%`

                return `${quorumValue} 名`
              },
            },
            {
              header: "議決方式",
              toValue: (resource) => readResourceText(resource, "decisionRule") ?? "-",
            },
          ]}
        />
      </section>
    </div>
  )
}
