import Link from "next/link"
import { toConnectorDirectionLabel } from "@/app/(app)/system/connectors/_lib/to-connector-direction-label"
import { toConnectorStatusLabel } from "@/app/(app)/system/connectors/_lib/to-connector-status-label"
import { toConnectorTransportLabel } from "@/app/(app)/system/connectors/_lib/to-connector-transport-label"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { getSystemConnectors } from "@/lib/api/get-system-connectors"

type Props = {
  connectorId: string
}

/**
 * 1 件の Connector を読む。
 * api は Connector 単体の GET を持たないので、一覧を取って識別子で選ぶ。
 */
export async function SystemConnectorDetailSection(props: Props) {
  const connectors = await getSystemConnectors()

  if (connectors instanceof Error) {
    return <FetchError message="コネクタの取得に失敗しました" />
  }

  const connector = connectors.find((candidate) => candidate.id === props.connectorId)

  if (connector === undefined) {
    return (
      <EmptyState
        title="コネクタが見つかりません"
        description="この識別子のコネクタは登録されていません。一覧から選び直します。"
      />
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{connector.name}</h2>

      <dl className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">識別子</dt>

          <dd className="font-mono text-xs">{connector.id}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">キー</dt>

          <dd className="font-mono text-xs">{connector.key}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">向き</dt>

          <dd className="text-sm">{toConnectorDirectionLabel(connector.direction)}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">transport</dt>

          <dd className="text-sm">{toConnectorTransportLabel(connector.transport)}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">状態</dt>

          <dd className="text-sm">{toConnectorStatusLabel(connector.status)}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">版</dt>

          <dd className="text-sm">{connector.revision}</dd>
        </div>
      </dl>

      <Link
        className="text-sm underline"
        href={`/system/integration-exchanges?connector_id=${encodeURIComponent(connector.id)}`}
      >
        このコネクタの外部交換を見る
      </Link>
    </section>
  )
}
