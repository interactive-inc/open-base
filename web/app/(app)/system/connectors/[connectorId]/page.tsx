import Link from "next/link"
import { Suspense } from "react"
import { SystemConnectorDetailSection } from "@/app/(app)/system/connectors/[connectorId]/_components/system-connector-detail-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ReadOnlyNotice } from "@/components/read-only-notice"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "コネクタの詳細" }

type Props = {
  params: Promise<{ connectorId: string }>
}

/**
 * 1 件の Connector と、そこから外部交換への導線を読む。
 * integration:read は権限カタログに無く付与できないので、一覧と同じく system:admin で判定する。
 */
export default async function SystemConnectorPage(props: Props) {
  await requirePermission("system:admin")

  const params = await props.params

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="コネクタの詳細" />

      <ReadOnlyNotice command={null} />

      <Link className="text-sm underline" href="/system/connectors">
        コネクタの一覧へ戻る
      </Link>

      <Suspense fallback={<ListSkeleton rows={3} />}>
        <SystemConnectorDetailSection connectorId={params.connectorId} />
      </Suspense>
    </div>
  )
}
