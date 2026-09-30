import { Suspense } from "react"
import { SystemPrincipalSection } from "@/app/(app)/system/principals/_components/system-principal-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ReadOnlyNotice } from "@/components/read-only-notice"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "Principal" }

/**
 * Principal 一覧。Account と独立した主体の分類（人・エージェント・
 * サービス・コネクタ）を読む。
 */
export default async function SystemPrincipalsPage() {
  await requirePermission("iam:read")

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Principal" />

      <ReadOnlyNotice command={null} />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <SystemPrincipalSection />
      </Suspense>
    </div>
  )
}
