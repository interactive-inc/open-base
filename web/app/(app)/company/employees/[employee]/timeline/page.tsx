import { EmployeeLifecycleTimeline } from "@/app/(app)/company/employees/[employee]/_components/employee-lifecycle-timeline"
import { BackButton } from "@/components/back-button"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { getEmployeeLifecycleEvents } from "@/lib/api/get-employee-lifecycle-events"

export const metadata = { title: "人材タイムライン" }

export default async function EmployeeTimelinePage(props: {
  params: Promise<{ employee: string }>
  searchParams: Promise<{ cursor?: string }>
}) {
  const [routeParams, query] = await Promise.all([props.params, props.searchParams])
  const code = routeParams.employee
  const events = await getEmployeeLifecycleEvents(code, { cursor: query.cursor })
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="人材タイムライン">
        <BackButton href={`/company/employees/${encodeURIComponent(code)}`} label="詳細に戻る" />
      </PageHeader>
      {events instanceof Error ? (
        <FetchError message="人事タイムラインの取得に失敗しました" />
      ) : (
        <EmployeeLifecycleTimeline code={code} events={events} />
      )}
    </div>
  )
}
