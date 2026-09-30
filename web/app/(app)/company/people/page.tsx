import { Suspense } from "react"
import { CompanyPeopleSection } from "@/app/(app)/company/people/_components/company-people-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ReadOnlyNotice } from "@/components/read-only-notice"
import { requireAnyPermission } from "@/lib/auth/require-any-permission"

export const metadata = { title: "人" }

/**
 * Person 一覧。雇用と切り離した「人そのもの」の台帳で、
 * 在籍状態は雇用（/company/employments）が持つ。
 */
export default async function CompanyPeoplePage() {
  await requireAnyPermission(["employee:read", "org:manage", "system:admin"])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="人" />

      <ReadOnlyNotice command={null} />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <CompanyPeopleSection />
      </Suspense>
    </div>
  )
}
