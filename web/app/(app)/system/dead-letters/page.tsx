import { Suspense } from "react"
import { SystemDeadLetterSection } from "@/app/(app)/system/dead-letters/_components/system-dead-letter-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ReadOnlyNotice } from "@/components/read-only-notice"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "dead letter" }

/**
 * 再試行の上限に達した配信の一覧。再投入は API と CLI が持つので、
 * この画面には再投入の導線を置かない。
 */
export default async function SystemDeadLettersPage() {
  await requirePermission("batch:view")

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="dead letter" />

      <ReadOnlyNotice command={null} />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <SystemDeadLetterSection />
      </Suspense>
    </div>
  )
}
