import { Suspense } from "react"
import { SystemExchangeConnectorForm } from "@/app/(app)/system/integration-exchanges/_components/system-exchange-connector-form"
import { SystemIntegrationExchangeSection } from "@/app/(app)/system/integration-exchanges/_components/system-integration-exchange-section"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ReadOnlyNotice } from "@/components/read-only-notice"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "外部交換" }

type Props = {
  searchParams: Promise<{ [key: string]: string | Array<string> | undefined }>
}

/**
 * 外部交換の一覧。api が connector_id を必須にするので、
 * コネクタを選ぶまでは取得せず選択を促す。
 * integration:read は権限カタログに無く付与できないので、system:admin で判定する。
 */
export default async function SystemIntegrationExchangesPage(props: Props) {
  await requirePermission("system:admin")

  const params = await props.searchParams

  const connectorId = toConnectorId(params.connector_id)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="外部交換" />

      <ReadOnlyNotice command={null} />

      <Suspense fallback={<ListSkeleton rows={1} />}>
        <SystemExchangeConnectorForm connectorId={connectorId} />
      </Suspense>

      {connectorId === null ? (
        <EmptyState
          title="コネクタを選びます"
          description="外部交換はコネクタ単位で記録するので、まずコネクタを選びます。"
        />
      ) : (
        <Suspense key={connectorId} fallback={<ListSkeleton rows={5} />}>
          <SystemIntegrationExchangeSection connectorId={connectorId} />
        </Suspense>
      )}
    </div>
  )
}

/** searchParams の connector_id を 1 つの文字列に絞る。未指定は null。 */
function toConnectorId(value: string | Array<string> | undefined): string | null {
  if (typeof value !== "string") return null

  if (value.length === 0) return null

  return value
}
