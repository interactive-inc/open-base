import { notFound } from "next/navigation"
import Link from "next/link"
import { WorkflowRepairList } from "@/app/(app)/system/workflow-repairs/_components/workflow-repair-list"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { PAGE_SIZE_OPTIONS, parsePageSize } from "@/lib/pagination/parse-page-size"
import { Button } from "@/components/ui/button"
import { canManageWorkflowRepairs } from "@/lib/application/can-manage-workflow-repairs"
import { getMe } from "@/lib/api/get-me"
import { getWorkflowRepairs } from "@/lib/api/get-workflow-repairs"

export const metadata = { title: "ワークフロー修復" }

type Props = {
  searchParams: Promise<{ page?: string; size?: string }>
}

export default async function WorkflowRepairsPage(props: Props) {
  const searchParams = await props.searchParams
  const pageSize = parsePageSize(searchParams.size)
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1)
  const offset = (page - 1) * pageSize
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageWorkflowRepairs(currentUser.permissions) === false) {
    notFound()
  }

  const result = await getWorkflowRepairs({ limit: pageSize, offset })

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="ワークフロー修復">
        <Button
          variant="secondary"
          nativeButton={false}
          render={<Link href="/system/applications" />}
        >
          申請管理へ
        </Button>
      </PageHeader>

      {result instanceof Error ? (
        <FetchError message="承認フローの修復対象を取得できませんでした" />
      ) : (
        <>
          <WorkflowRepairList repairs={result.data} />
          <TablePagination
            pathname="/system/workflow-repairs"
            total={result.total}
            limit={pageSize}
            offset={offset}
            extraParams={{ size: String(pageSize) }}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
        </>
      )}
    </div>
  )
}
