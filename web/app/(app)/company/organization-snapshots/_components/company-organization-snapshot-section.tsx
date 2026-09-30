import Link from "next/link"
import { CompanyResourceTable } from "@/components/company-resource-table"
import { FetchError } from "@/components/fetch-error"
import { getCompanyOrganizationSnapshot } from "@/lib/api/get-company-organization-snapshot"
import { filterResourcesByType } from "@/lib/company/filter-resources-by-type"
import { readResourceBoolean } from "@/lib/company/read-resource-boolean"
import { readResourceText } from "@/lib/company/read-resource-text"

type Props = {
  effectiveOn: string | null
}

const emptyDescription = "組織の正本は API と CLI が持ちます。この時点の登録がありません。"

/** 指定時点の組織構造を種別ごとに読み取り専用で並べる。 */
export async function CompanyOrganizationSnapshotSection(props: Props) {
  const snapshot = await getCompanyOrganizationSnapshot({ effectiveOn: props.effectiveOn })

  if (snapshot instanceof Error) {
    return <FetchError message="組織の時点断面の取得に失敗しました" />
  }

  const organizationUnits = filterResourcesByType(snapshot.resources, "organization-unit")

  const assignments = filterResourcesByType(snapshot.resources, "assignment")

  const reportingRelations = filterResourcesByType(snapshot.resources, "reporting-relation")

  const responsibilityAssignments = filterResourcesByType(
    snapshot.resources,
    "responsibility-assignment",
  )

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-muted-foreground">
        組織 revision {snapshot.organizationRevision} 時点の内容です。
      </p>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">組織単位</h2>

        <CompanyResourceTable
          caption="組織単位の一覧"
          resources={organizationUnits}
          emptyTitle="組織単位がありません"
          emptyDescription={emptyDescription}
          columns={[
            {
              header: "コード",
              toValue: (resource) => {
                const code = readResourceText(resource, "code")

                if (code === null) return "-"

                return (
                  <Link href={`/teams/${code}`} className="underline underline-offset-4">
                    {code}
                  </Link>
                )
              },
            },
            {
              header: "正式名称",
              toValue: (resource) => readResourceText(resource, "officialName") ?? "-",
            },
            { header: "区分", toValue: (resource) => readResourceText(resource, "kind") ?? "-" },
            {
              header: "親組織",
              toValue: (resource) =>
                readResourceText(resource, "parentOrganizationUnitId") ?? "（最上位）",
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">配属</h2>

        <CompanyResourceTable
          caption="配属の一覧"
          resources={assignments}
          emptyTitle="配属がありません"
          emptyDescription={emptyDescription}
          columns={[
            {
              header: "従業員",
              toValue: (resource) => readResourceText(resource, "employeeId") ?? "-",
            },
            {
              header: "組織単位",
              toValue: (resource) => readResourceText(resource, "organizationUnitId") ?? "-",
            },
            {
              header: "区分",
              toValue: (resource) => readResourceText(resource, "assignmentType") ?? "-",
            },
            {
              header: "役職名",
              toValue: (resource) => readResourceText(resource, "positionTitle") ?? "-",
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">レポートライン</h2>

        <CompanyResourceTable
          caption="レポートラインの一覧"
          resources={reportingRelations}
          emptyTitle="レポートラインがありません"
          emptyDescription={emptyDescription}
          columns={[
            {
              header: "従業員",
              toValue: (resource) => readResourceText(resource, "employeeId") ?? "-",
            },
            {
              header: "上長",
              toValue: (resource) => readResourceText(resource, "managerEmployeeId") ?? "-",
            },
            {
              header: "組織単位",
              toValue: (resource) => readResourceText(resource, "organizationUnitId") ?? "-",
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">責任の割当</h2>

        <CompanyResourceTable
          caption="責任の割当の一覧"
          resources={responsibilityAssignments}
          emptyTitle="責任の割当がありません"
          emptyDescription={emptyDescription}
          columns={[
            {
              header: "責任",
              toValue: (resource) => readResourceText(resource, "responsibilityId") ?? "-",
            },
            {
              header: "保持者の種別",
              toValue: (resource) => readResourceText(resource, "holderType") ?? "-",
            },
            {
              header: "保持者",
              toValue: (resource) => readResourceText(resource, "holderId") ?? "-",
            },
            {
              header: "再委任",
              toValue: (resource) => {
                const delegationAllowed = readResourceBoolean(resource, "delegationAllowed")

                if (delegationAllowed === null) return "-"

                return delegationAllowed ? "可" : "不可"
              },
            },
          ]}
        />
      </section>
    </div>
  )
}
