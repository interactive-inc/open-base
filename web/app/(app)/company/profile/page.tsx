import { Suspense } from "react"
import { CompanyProfileSection } from "@/app/(app)/company/profile/_components/company-profile-section"
import { CompanySiteSection } from "@/app/(app)/company/profile/_components/company-site-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ReadOnlyNotice } from "@/components/read-only-notice"
import { requireAnyPermission } from "@/lib/auth/require-any-permission"

export const metadata = { title: "会社と法人" }

/**
 * 会社の文脈そのものを読む画面。法人（LegalEntity）と会社 profile を上に、
 * 事業所（Site）と勤務場所（Workplace）を下に並べる。
 */
export default async function CompanyProfilePage() {
  await requireAnyPermission(["employee:read", "org:manage", "system:admin"])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="会社と法人" />

      <ReadOnlyNotice command={null} />

      <Suspense fallback={<ListSkeleton rows={3} />}>
        <CompanyProfileSection />
      </Suspense>

      <Suspense fallback={<ListSkeleton rows={3} />}>
        <CompanySiteSection />
      </Suspense>
    </div>
  )
}
