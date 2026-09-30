import { Suspense } from "react"
import { SystemConnectorSection } from "@/app/(app)/system/connectors/_components/system-connector-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ReadOnlyNotice } from "@/components/read-only-notice"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "コネクタ" }

/**
 * Connector 一覧。外部境界の主体と transport の定義を読む。
 *
 * api の route は integration:read を要求するが、このキーは権限カタログに無く
 * ロールから付与できない。実際に到達できるのは system:admin を持つ利用者だけなので、
 * nav と画面もそれに合わせる（integration:read で判定すると誰にも出なくなる）。
 */
export default async function SystemConnectorsPage() {
  await requirePermission("system:admin")

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="コネクタ" />

      <ReadOnlyNotice command={null} />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <SystemConnectorSection />
      </Suspense>
    </div>
  )
}
