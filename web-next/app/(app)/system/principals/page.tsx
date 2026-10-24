import { Suspense } from "react"
import { SystemPrincipalSection } from "@/app/(app)/system/principals/_components/system-principal-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "主体" }

/**
 * Principal 一覧。Account と独立した主体の分類（人・エージェント・
 * サービス・コネクタ）を読む。
 */
export default async function SystemPrincipalsPage() {
  await requirePermission("iam:read")

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="主体" />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <SystemPrincipalSection />
      </Suspense>
    </div>
  )
}
