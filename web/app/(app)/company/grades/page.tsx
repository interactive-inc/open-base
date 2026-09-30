import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { GradeList } from "@/app/(app)/company/grades/_components/grade-list"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getGradeList } from "@/lib/api/get-grade-list"
import { getMe } from "@/lib/api/get-me"
import { canManageGrades } from "@/lib/grade/can-manage-grades"

export const metadata = { title: "等級" }

/**
 * 等級マスタ一覧。等級は公開情報のため全員が参照でき、作成・変更・削除は
 * grade:manage を持つ管理者にのみ出し分ける。
 */
export default async function GradesPage() {
  const currentUser = await getMe()

  const canManage = currentUser instanceof Error ? false : canManageGrades(currentUser.permissions)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="等級">
        {canManage ? (
          <Button nativeButton={false} render={<Link href="/company/grades/new" />}>
            <Plus />
            新規等級
          </Button>
        ) : null}
      </PageHeader>

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <Grades canManage={canManage} />
      </Suspense>
    </div>
  )
}

async function Grades(props: { canManage: boolean }) {
  const grades = await getGradeList()

  if (grades instanceof Error) {
    return <FetchError message="等級の取得に失敗しました" />
  }

  return <GradeList grades={grades.grades} canManage={props.canManage} />
}
