import Link from "next/link"
import { toConnectorDirectionLabel } from "@/app/(app)/system/connectors/_lib/to-connector-direction-label"
import { toExchangeStatusLabel } from "@/app/(app)/system/integration-exchanges/_lib/to-exchange-status-label"
import { FetchError } from "@/components/fetch-error"
import { SystemResourceTable } from "@/components/system-resource-table"
import { getSystemIntegrationExchanges } from "@/lib/api/get-system-integration-exchanges"

type Props = {
  connectorId: string
}

/**
 * 1 つの Connector で起きた外部交換を読み取り専用で並べる。
 * api は entity をそのまま返し時刻を含めないので、発生時刻の列は出せない。
 */
export async function SystemIntegrationExchangeSection(props: Props) {
  const exchanges = await getSystemIntegrationExchanges(props.connectorId)

  if (exchanges instanceof Error) {
    return <FetchError message="外部交換の取得に失敗しました" />
  }

  return (
    <SystemResourceTable
      caption="外部交換の一覧"
      resources={exchanges}
      toKey={(exchange) => exchange.id}
      emptyTitle="外部交換がありません"
      emptyDescription="このコネクタではまだ交換が記録されていません。"
      columns={[
        {
          header: "操作",
          toValue: (exchange) => (
            <Link
              className="font-mono text-xs underline"
              href={`/system/integration-exchanges/${exchange.id}`}
            >
              {exchange.operationKey}
            </Link>
          ),
        },
        { header: "向き", toValue: (exchange) => toConnectorDirectionLabel(exchange.direction) },
        { header: "状態", toValue: (exchange) => toExchangeStatusLabel(exchange.status) },
        { header: "試行", toValue: (exchange) => exchange.attempt },
        { header: "外部の参照", toValue: (exchange) => exchange.externalReference ?? "-" },
        { header: "直近のエラー", toValue: (exchange) => exchange.lastErrorCode ?? "-" },
      ]}
    />
  )
}
