import Link from "next/link"
import { Suspense } from "react"
import { SystemIntegrationExchangeDetailSection } from "@/app/(app)/system/integration-exchanges/[exchangeId]/_components/system-integration-exchange-detail-section"
import { SystemReconciliationSection } from "@/app/(app)/system/integration-exchanges/[exchangeId]/_components/system-reconciliation-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ReadOnlyNotice } from "@/components/read-only-notice"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "外部交換の詳細" }

type Props = {
  params: Promise<{ exchangeId: string }>
}

/**
 * 1 件の外部交換と、その照合履歴を読む。
 * integration:read は権限カタログに無く付与できないので、system:admin で判定する。
 */
export default async function SystemIntegrationExchangePage(props: Props) {
  await requirePermission("system:admin")

  const params = await props.params

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="外部交換の詳細" />

      <ReadOnlyNotice command={null} />

      <Link className="text-sm underline" href="/system/integration-exchanges">
        外部交換の一覧へ戻る
      </Link>

      <Suspense fallback={<ListSkeleton rows={3} />}>
        <SystemIntegrationExchangeDetailSection exchangeId={params.exchangeId} />
      </Suspense>

      <Suspense fallback={<ListSkeleton rows={3} />}>
        <SystemReconciliationSection exchangeId={params.exchangeId} />
      </Suspense>
    </div>
  )
}
