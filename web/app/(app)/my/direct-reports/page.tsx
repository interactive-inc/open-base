import { Suspense } from "react"
import { Users } from "lucide-react"
import { CardLink } from "@/components/card-link"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getMyReports } from "@/lib/api/get-my-reports"

export const metadata = { title: "マイチーム" }
export default function MyReportsPage() {
  return (
    <>
      <PageHeader title="マイチーム" />
      <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-24 w-full" />}>
        <ReportsGrid />
      </Suspense>
    </>
  )
}
async function ReportsGrid() {
  const result = await getMyReports()

  if (result instanceof Error) {
    return <FetchError message="マイチームを読み込めませんでした。" />
  }

  if (result.data.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="直属の部下はいません"
        description="あなたが上司に設定されている在籍中の従業員が表示されます。"
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {result.data.map((report) => {
        const content = (
          <>
            <CardTitle>{report.name}</CardTitle>
            <CardDescription>
              {[report.dept_name, report.position].filter((value) => value !== null).join(" / ") ||
                "所属未設定"}
            </CardDescription>
          </>
        )
        return report.code === null ? (
          <Card key={report.employee_id}>
            <CardHeader>{content}</CardHeader>
          </Card>
        ) : (
          <CardLink
            key={report.employee_id}
            href={`/company/employees/${encodeURIComponent(report.code)}`}
            className="flex min-h-24 flex-col gap-2"
          >
            {content}
          </CardLink>
        )
      })}
    </div>
  )
}
