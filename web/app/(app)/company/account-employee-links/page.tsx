import { Suspense } from "react"
import { CompanyAccountEmployeeLinkSection } from "@/app/(app)/company/account-employee-links/_components/company-account-employee-link-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { requireAnyPermission } from "@/lib/auth/require-any-permission"

export const metadata = { title: "アカウントの紐付け" }

/**
 * System の Account と Company の Employee の対応を読む画面。
 * System の汎用判断へ会社上の資格を渡すときの結び目にあたる。
 */
export default async function CompanyAccountEmployeeLinksPage() {
  await requireAnyPermission(["employee:read", "org:manage", "system:admin"])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="アカウントの紐付け" />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <CompanyAccountEmployeeLinkSection />
      </Suspense>
    </div>
  )
}
