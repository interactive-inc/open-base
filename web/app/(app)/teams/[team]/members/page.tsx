import { Suspense } from "react"
import { DepartmentName } from "@/app/(app)/teams/[team]/_components/department-name"
import { OrgMembersTable } from "@/app/(app)/teams/[team]/_components/org-members-table"
import { TeamMemberAddForm } from "@/app/(app)/teams/[team]/_components/team-member-add-form"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { getPersonnelPositionSnapshot } from "@/lib/api/get-personnel-position-snapshot"
import { requireAuth } from "@/lib/auth/require-auth"

export const metadata = { title: "メンバー" }

type Props = {
  params: Promise<{ team: string }>
}

/**
 * 部署メンバー画面（部署ハブのメンバータブ）。
 * 直接発令の権限を持つ利用者は、この部署を対象にした配属（主配属・兼務）をここから登録できる。
 */
export default async function OrgDepartmentMembersPage(props: Props) {
  const params = await props.params

  const me = await requireAuth()

  const canApply = me.permissions.includes("employee:lifecycle:apply")

  const snapshot = canApply ? await getPersonnelPositionSnapshot() : null

  const addForm =
    canApply && snapshot !== null && !(snapshot instanceof Error) ? (
      <TeamMemberAddForm teamCode={params.team} companyRevision={snapshot.companyRevision} />
    ) : null

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="メンバー">{addForm}</PageHeader>

      <DepartmentName team={params.team} />

      <Suspense fallback={<ListSkeleton rows={5} rowClassName="h-10 w-full" />}>
        <OrgMembersTable code={params.team} />
      </Suspense>
    </div>
  )
}
