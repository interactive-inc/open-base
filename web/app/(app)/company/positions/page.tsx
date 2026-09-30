import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { PositionList } from "@/app/(app)/company/positions/_components/position-list"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getPositionList } from "@/lib/api/get-position-list"
import { getMe } from "@/lib/api/get-me"
import { canManagePositions } from "@/lib/position/can-manage-positions"

export const metadata = { title: "役職" }

/**
 * 役職マスタ一覧。役職は公開情報のため全員が参照でき、作成・変更・削除は
 * position:manage を持つ管理者にのみ出し分ける。
 */
export default async function PositionsPage() {
  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error ? false : canManagePositions(currentUser.permissions)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="役職">
        {canManage ? (
          <Button nativeButton={false} render={<Link href="/company/positions/new" />}>
            <Plus />
            新規役職
          </Button>
        ) : null}
      </PageHeader>

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <Positions canManage={canManage} />
      </Suspense>
    </div>
  )
}

async function Positions(props: { canManage: boolean }) {
  const positions = await getPositionList()

  if (positions instanceof Error) {
    return <FetchError message="役職の取得に失敗しました" />
  }

  return <PositionList positions={positions.positions} canManage={props.canManage} />
}
