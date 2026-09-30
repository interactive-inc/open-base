import Link from "next/link"
import { toConnectorDirectionLabel } from "@/app/(app)/system/connectors/_lib/to-connector-direction-label"
import { toConnectorStatusLabel } from "@/app/(app)/system/connectors/_lib/to-connector-status-label"
import { toConnectorTransportLabel } from "@/app/(app)/system/connectors/_lib/to-connector-transport-label"
import { FetchError } from "@/components/fetch-error"
import { SystemResourceTable } from "@/components/system-resource-table"
import { getSystemConnectors } from "@/lib/api/get-system-connectors"

/**
 * Connector を読み取り専用で並べる。
 * api は entity をそのまま返し時刻を含めないので、作成・更新の列は出せない。
 */
export async function SystemConnectorSection() {
  const connectors = await getSystemConnectors()

  if (connectors instanceof Error) {
    return <FetchError message="コネクタの取得に失敗しました" />
  }

  return (
    <SystemResourceTable
      caption="コネクタの一覧"
      resources={connectors}
      toKey={(connector) => connector.id}
      emptyTitle="コネクタが登録されていません"
      emptyDescription="外部接続の定義は API と CLI から登録します。まだ登録がありません。"
      columns={[
        {
          header: "名称",
          toValue: (connector) => (
            <Link className="underline" href={`/system/connectors/${connector.id}`}>
              {connector.name}
            </Link>
          ),
        },
        {
          header: "キー",
          toValue: (connector) => <span className="font-mono text-xs">{connector.key}</span>,
        },
        { header: "向き", toValue: (connector) => toConnectorDirectionLabel(connector.direction) },
        {
          header: "transport",
          toValue: (connector) => toConnectorTransportLabel(connector.transport),
        },
        { header: "状態", toValue: (connector) => toConnectorStatusLabel(connector.status) },
        { header: "版", toValue: (connector) => connector.revision },
      ]}
    />
  )
}
