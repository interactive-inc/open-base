import { Suspense } from "react"
import { EmployeeDetail } from "@/app/(app)/company/employees/[employee]/_components/employee-detail"
import { EmployeeEventHistory } from "@/app/(app)/company/employees/[employee]/_components/employee-event-history"
import { EmployeeGradeHistory } from "@/app/(app)/company/employees/[employee]/_components/employee-grade-history"
import { BackButton } from "@/components/back-button"
import { DetailSkeleton } from "@/components/detail-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { canReadEmployees } from "@/lib/employee/can-read-employees"
import { notFound } from "next/navigation"

export const metadata = { title: "従業員詳細" }

type Props = {
  params: Promise<{ employee: string }>
}

/** 従業員詳細画面。params.employee で対象を取得し、詳細カードを Suspense 境界で描画する RSC。 */
export default async function EmployeeDetailPage(props: Props) {
  const [params, currentUser] = await Promise.all([props.params, getMe()])

  if (
    currentUser instanceof Error ||
    (currentUser.code !== params.employee && canReadEmployees(currentUser.permissions) === false)
  ) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="従業員詳細">
        <BackButton href="/company/employees" label="一覧に戻る" />
      </PageHeader>

      <Suspense fallback={<DetailSkeleton fields={5} />}>
        <EmployeeDetail code={params.employee} permissions={currentUser.permissions} />
      </Suspense>

      <Suspense fallback={<Skeleton className="w-full" />}>
        <EmployeeGradeHistory code={params.employee} />
      </Suspense>

      <Suspense fallback={<Skeleton className="w-full" />}>
        <EmployeeEventHistory code={params.employee} />
      </Suspense>
    </div>
  )
}
