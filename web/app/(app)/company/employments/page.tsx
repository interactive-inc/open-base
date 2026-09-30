import { Suspense } from "react"
import { CompanyEmploymentFilterForm } from "@/app/(app)/company/employments/_components/company-employment-filter-form"
import { CompanyEmploymentSection } from "@/app/(app)/company/employments/_components/company-employment-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ReadOnlyNotice } from "@/components/read-only-notice"
import { requireAnyPermission } from "@/lib/auth/require-any-permission"

export const metadata = { title: "雇用" }

type Props = {
  searchParams: Promise<{ [key: string]: string | Array<string> | undefined }>
}

/**
 * Employment 一覧。在籍状態と有効期間の正本で、
 * status の絞り込みは URL の searchParams から読む。
 */
export default async function CompanyEmploymentsPage(props: Props) {
  await requireAnyPermission(["employee:read", "org:manage", "system:admin"])

  const params = await props.searchParams

  const status = toStatus(params.status)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="雇用" />

      <ReadOnlyNotice command={null} />

      <CompanyEmploymentFilterForm status={status} />

      <Suspense key={status ?? ""} fallback={<ListSkeleton rows={5} />}>
        <CompanyEmploymentSection status={status} />
      </Suspense>
    </div>
  )
}

/** status を Employment の在籍区分だけに絞り込む。範囲外は null。 */
function toStatus(value: string | Array<string> | undefined): string | null {
  if (value === "ACTIVE") return "ACTIVE"

  if (value === "ON_LEAVE") return "ON_LEAVE"

  if (value === "TERMINATED") return "TERMINATED"

  return null
}
