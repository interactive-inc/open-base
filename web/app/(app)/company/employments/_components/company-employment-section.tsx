import { CompanyResourceTable } from "@/components/company-resource-table"
import { FetchError } from "@/components/fetch-error"
import { getCompanyEmploymentResources } from "@/lib/api/get-company-employment-resources"
import { filterResourcesByType } from "@/lib/company/filter-resources-by-type"
import { readResourceText } from "@/lib/company/read-resource-text"

type Props = {
  status: string | null
}

const statusLabels: Record<string, string> = {
  ACTIVE: "在籍",
  ON_LEAVE: "休職",
  TERMINATED: "退職",
}

/**
 * Employment を読み取り専用で並べる。
 * api の GET は在籍区分での絞り込みを持たないため、取得後に status で絞る。
 */
export async function CompanyEmploymentSection(props: Props) {
  const employments = await getCompanyEmploymentResources()

  if (employments instanceof Error) {
    return <FetchError message="雇用の取得に失敗しました" />
  }

  const allEmployments = filterResourcesByType(employments.resources, "employment")

  const visibleEmployments =
    props.status === null
      ? allEmployments
      : allEmployments.filter(
          (employment) => readResourceText(employment, "status") === props.status,
        )

  return (
    <CompanyResourceTable
      caption="雇用の一覧"
      resources={visibleEmployments}
      emptyTitle="雇用が登録されていません"
      emptyDescription="該当する雇用がありません。絞り込みを変えるか、CLI から登録します。"
      columns={[
        {
          header: "従業員",
          toValue: (resource) => readResourceText(resource, "employeeId") ?? "-",
        },
        {
          header: "在籍区分",
          toValue: (resource) => {
            const status = readResourceText(resource, "status")

            if (status === null) return "-"

            return statusLabels[status] ?? status
          },
        },
        {
          header: "雇用形態",
          toValue: (resource) => readResourceText(resource, "employmentType") ?? "-",
        },
        {
          header: "名称",
          toValue: (resource) => readResourceText(resource, "officialName") ?? "-",
        },
      ]}
    />
  )
}
