import { CompanyResourceTable } from "@/components/company-resource-table"
import { FetchError } from "@/components/fetch-error"
import { getCompanyProfileResources } from "@/lib/api/get-company-profile-resources"
import { filterResourcesByType } from "@/lib/company/filter-resources-by-type"
import { readResourceNumber } from "@/lib/company/read-resource-number"
import { readResourceText } from "@/lib/company/read-resource-text"

const emptyDescription = "会社の正本は API と CLI が持ちます。まだ登録がありません。"

/** 法人（LegalEntity）と会社 profile を読み取り専用で並べる。 */
export async function CompanyProfileSection() {
  const profile = await getCompanyProfileResources()

  if (profile instanceof Error) {
    return <FetchError message="会社と法人の取得に失敗しました" />
  }

  const legalEntities = filterResourcesByType(profile.resources, "legal-entity")

  const companyProfiles = filterResourcesByType(profile.resources, "company-profile")

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">法人</h2>

        <CompanyResourceTable
          caption="法人の一覧"
          resources={legalEntities}
          emptyTitle="法人が登録されていません"
          emptyDescription={emptyDescription}
          columns={[
            {
              header: "正式名称",
              toValue: (resource) => readResourceText(resource, "officialName") ?? "-",
            },
            {
              header: "法域",
              toValue: (resource) => readResourceText(resource, "jurisdictionCountryCode") ?? "-",
            },
            {
              header: "登記番号",
              toValue: (resource) => readResourceText(resource, "registrationNumber") ?? "-",
            },
            {
              header: "既定通貨",
              toValue: (resource) => readResourceText(resource, "defaultCurrencyCode") ?? "-",
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">会社プロフィール</h2>

        <CompanyResourceTable
          caption="会社プロフィールの一覧"
          resources={companyProfiles}
          emptyTitle="会社プロフィールが登録されていません"
          emptyDescription={emptyDescription}
          columns={[
            {
              header: "表示名",
              toValue: (resource) => readResourceText(resource, "displayName") ?? "-",
            },
            {
              header: "ロケール",
              toValue: (resource) => readResourceText(resource, "locale") ?? "-",
            },
            {
              header: "タイムゾーン",
              toValue: (resource) => readResourceText(resource, "timeZone") ?? "-",
            },
            {
              header: "会計年度の開始月",
              toValue: (resource) => {
                const month = readResourceNumber(resource, "fiscalYearStartMonth")

                if (month === null) return "-"

                return `${month} 月`
              },
            },
          ]}
        />
      </section>
    </div>
  )
}
