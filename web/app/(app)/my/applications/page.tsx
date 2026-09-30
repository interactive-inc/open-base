import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { Suspense } from "react"
import { MyApplicationsList } from "@/app/(app)/my/applications/_components/my-applications-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { PAGE_SIZE_OPTIONS, parsePageSize } from "@/lib/pagination/parse-page-size"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { listMyApplications } from "@/lib/api/list-my-applications"
import { canViewAllApplications } from "@/lib/application/can-view-all-applications"

export const metadata = { title: "申請" }

type SearchParams = Promise<{ page?: string; size?: string }>

/** 自分の申請一覧画面。RSC でサーバ取得し、承認待ちは変更・取り下げ操作付きで表示する。 */
export default async function MyApplicationsPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams

  const pageSize = parsePageSize(searchParams.size)

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1)

  const offset = (page - 1) * pageSize

  const currentUser = await getMe()

  const canViewAll =
    currentUser instanceof Error ? false : canViewAllApplications(currentUser.permissions)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="申請">
        {canViewAll ? (
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href="/system/applications" />}
          >
            申請管理
          </Button>
        ) : null}

        <Button
          variant="secondary"
          nativeButton={false}
          render={<Link href="/inbox/applications" />}
        >
          承認 inbox
        </Button>

        <Button nativeButton={false} render={<Link href="/system/application-templates" />}>
          新規申請
        </Button>
      </PageHeader>

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <MyApplicationsTable offset={offset} pageSize={pageSize} />
      </Suspense>
    </div>
  )
}

async function MyApplicationsTable(props: { offset: number; pageSize: number }) {
  const result = await listMyApplications({ limit: props.pageSize, offset: props.offset })

  if (result instanceof Error) {
    return <FetchError message="申請一覧の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-4">
      <MyApplicationsList applications={result.data} />

      <TablePagination
        pathname="/my/applications"
        total={result.total}
        limit={props.pageSize}
        offset={props.offset}
        extraParams={{ size: String(props.pageSize) }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </div>
  )
}
