import { FetchError } from "@/components/fetch-error"
import { formatDateTime } from "@/lib/format-date-time"
import Link from "next/link"
import { Suspense } from "react"
import { TablePagination } from "@/components/table-pagination"
import { PAGE_SIZE_OPTIONS, parsePageSize } from "@/lib/pagination/parse-page-size"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { SubPageHeader } from "@/components/sub-page-header"
import { SortableTableHead } from "@/components/sortable-table-head"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getApplicationInbox, type ApplicationInboxSort } from "@/lib/api/get-application-inbox"
import { getMe } from "@/lib/api/get-me"
import { canViewAllApplications } from "@/lib/application/can-view-all-applications"

export const metadata = { title: "承認待ちの申請" }

const SORT_VALUES: ReadonlyArray<ApplicationInboxSort> = ["created_at_desc", "created_at_asc"]

type SearchParams = Promise<{ page?: string; size?: string; sort?: string }>

function toSort(raw: string | undefined): ApplicationInboxSort {
  if (raw !== undefined && (SORT_VALUES as ReadonlyArray<string>).includes(raw)) {
    return raw as ApplicationInboxSort
  }

  return "created_at_desc"
}

/** 承認 inbox 画面。RSC で承認待ち一覧を取得し、各行から申請内容の確認へ進む。 */
export default async function ApplicationInboxPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams

  const pageSize = parsePageSize(searchParams.size)

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1)

  const offset = (page - 1) * pageSize

  const sort = toSort(searchParams.sort)

  const currentUser = await getMe()

  const canViewAll =
    currentUser instanceof Error ? false : canViewAllApplications(currentUser.permissions)

  return (
    <div className="flex flex-col gap-8">
      <SubPageHeader
        title="承認待ちの申請"
        actions={
          <>
            <Button
              variant="secondary"
              nativeButton={false}
              render={<Link href="/teams/approval-delegations" />}
            >
              代理承認
            </Button>
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
              render={<Link href="/my/applications" />}
            >
              申請一覧へ
            </Button>
          </>
        }
      />

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-16 w-full" />}>
        <InboxTable offset={offset} pageSize={pageSize} sort={sort} />
      </Suspense>
    </div>
  )
}

async function InboxTable(props: { offset: number; pageSize: number; sort: ApplicationInboxSort }) {
  const result = await getApplicationInbox({
    limit: props.pageSize,
    offset: props.offset,
    sort: props.sort,
  })

  if (result instanceof Error) {
    return <FetchError message="inbox の取得に失敗しました" />
  }

  if (result.data.length === 0) {
    return <EmptyState title="承認待ちの申請はありません" />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <Table aria-label={`承認待ちの申請 ${result.total} 件`}>
          <TableHeader>
            <TableRow>
              <TableHead>申請名</TableHead>
              <TableHead>申請者</TableHead>
              <TableHead>ステータス</TableHead>
              <SortableTableHead
                pathname="/inbox/applications"
                currentSort={props.sort}
                ascValue="created_at_asc"
                descValue="created_at_desc"
                label="申請日"
                className="hidden md:table-cell"
              />
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {result.data.map((application) => (
              <TableRow key={application.id}>
                <TableCell>
                  <Link
                    href={`/system/applications/${application.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {application.template_name}
                  </Link>
                </TableCell>

                <TableCell>{application.applicant_name}</TableCell>

                <TableCell>
                  <ApplicationStatusBadge status={application.status} />
                </TableCell>

                <TableCell className="hidden md:table-cell">
                  {formatDateTime(application.created_at)}
                </TableCell>

                <TableCell>
                  <Link
                    href={`/system/applications/${application.id}`}
                    className="underline underline-offset-4"
                  >
                    内容を確認
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        pathname="/inbox/applications"
        total={result.total}
        limit={props.pageSize}
        offset={props.offset}
        extraParams={{
          sort: props.sort === "created_at_desc" ? undefined : props.sort,
          size: String(props.pageSize),
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </div>
  )
}
