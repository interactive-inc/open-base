import { Suspense } from "react"
import { SystemHealthSection } from "@/app/(app)/system/health/_components/system-health-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ReadOnlyNotice } from "@/components/read-only-notice"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "health" }

/**
 * api の health。
 * api の route は未認証でも到達できるが、システムタブは運用者の空間で、
 * 一般の従業員に見せる意味のある情報でもないので、画面は system:admin に絞る。
 */
export default async function SystemHealthPage() {
  await requirePermission("system:admin")

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="health" />

      <ReadOnlyNotice command={null} />

      <Suspense fallback={<ListSkeleton rows={1} />}>
        <SystemHealthSection />
      </Suspense>
    </div>
  )
}
