import { FetchError } from "@/components/fetch-error"
import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import {
  NotificationFilter,
  type NotificationFilterValue,
} from "@/app/(app)/notifications/_components/notification-filter"
import { NotificationList } from "@/app/(app)/notifications/_components/notification-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { PAGE_SIZE_OPTIONS, parsePageSize } from "@/lib/pagination/parse-page-size"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { getMyNotifications } from "@/lib/api/get-my-notifications"
import { canManageNotifications } from "@/lib/notifications/can-manage-notifications"

export const metadata = { title: "通知" }

type SearchParams = Promise<{ page?: string; size?: string; filter?: string }>

function toFilterValue(raw: string | undefined): NotificationFilterValue {
  if (raw === "unread") return "unread"
  if (raw === "read") return "read"
  return "all"
}

function filterToIsRead(filter: NotificationFilterValue): boolean | undefined {
  if (filter === "unread") return false
  if (filter === "read") return true
  return undefined
}

/**
 * 通知画面。自分宛ての通知一覧を RSC で取得して表示する。
 * 作成は /notifications/new に分離し、特権ロールにだけ導線を出す。
 * ?filter=unread|read で未読/既読の絞り込みができる。
 */
export default async function NotificationsPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams

  const pageSize = parsePageSize(searchParams.size)

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1)

  const offset = (page - 1) * pageSize

  const filter = toFilterValue(searchParams.filter)

  const currentUser = await getMe()

  const canCreate =
    currentUser instanceof Error ? false : canManageNotifications(currentUser.permissions)

  const suspenseKey = `${filter}:${page}:${pageSize}`

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="通知">
        {canCreate ? (
          <Button nativeButton={false} render={<Link href="/notifications/new" />}>
            <Plus />
            通知を作成
          </Button>
        ) : null}
      </PageHeader>

      <NotificationFilter current={filter} />

      <Suspense key={suspenseKey} fallback={<ListSkeleton rows={3} rowClassName="h-20 w-full" />}>
        <MyNotifications offset={offset} pageSize={pageSize} filter={filter} />
      </Suspense>
    </div>
  )
}

async function MyNotifications(props: {
  offset: number
  pageSize: number
  filter: NotificationFilterValue
}) {
  const isRead = filterToIsRead(props.filter)

  const result = await getMyNotifications({ limit: props.pageSize, offset: props.offset, isRead })

  if (result instanceof Error) {
    return <FetchError message="通知一覧の取得に失敗しました" />
  }

  const extraParams = {
    size: String(props.pageSize),
    ...(props.filter !== "all" ? { filter: props.filter } : {}),
  }

  return (
    <div className="flex flex-col gap-4">
      <NotificationList notifications={result.data} />

      <TablePagination
        pathname="/notifications"
        total={result.total}
        limit={props.pageSize}
        offset={props.offset}
        extraParams={extraParams}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </div>
  )
}
