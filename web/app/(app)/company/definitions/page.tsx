import { Suspense } from "react"
import { CompanyDefinitionSection } from "@/app/(app)/company/definitions/_components/company-definition-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ReadOnlyNotice } from "@/components/read-only-notice"
import { requireAnyPermission } from "@/lib/auth/require-any-permission"

export const metadata = { title: "職務と責任" }

/**
 * 職務（Job）、組織上の役職（OrganizationalOffice）、責任（Responsibility）、
 * 権限範囲（AuthorityScope）、合議体（CollectiveBody）の定義を読む画面。
 * 等級と役職マスタは /company/grades と /company/positions が正本なのでここには出さない。
 */
export default async function CompanyDefinitionsPage() {
  await requireAnyPermission(["employee:read", "org:manage", "system:admin"])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="職務と責任" />

      <ReadOnlyNotice command={null} />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <CompanyDefinitionSection />
      </Suspense>
    </div>
  )
}
