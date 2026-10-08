import { FetchError } from "@/components/fetch-error"
import { SystemResourceTable } from "@/components/system-resource-table"
import { getSystemDeliveries } from "@/lib/api/get-system-deliveries"
import type {
  SystemDeliveryKind,
  SystemDeliveryStatus,
} from "@/lib/api/types/system-operation-types"
import { formatDateTime } from "@/lib/format-date-time"

type Props = {
  kind: SystemDeliveryKind
  status: SystemDeliveryStatus | null
}

const statusLabels: Record<string, string> = {
  queued: "待機中",
  leased: "実行中",
  succeeded: "成功",
  dead_letter: "配信不能",
}

/** ジョブと送信箱の配信を読み取り専用で並べる。 */
export async function SystemDeliverySection(props: Props) {
  const deliveries = await getSystemDeliveries({ kind: props.kind, status: props.status })

  if (deliveries instanceof Error) {
    return <FetchError message="配信を読み込めませんでした。" />
  }

  return (
    <SystemResourceTable
      caption="配信の一覧"
      resources={deliveries}
      toKey={(delivery) => delivery.id}
      emptyTitle="配信がありません"
      emptyDescription="絞り込み条件を変えてお試しください。"
      columns={[
        {
          header: "処理",
          toValue: (delivery) => (
            <span className="font-mono text-xs">{delivery.operation_key}</span>
          ),
        },
        {
          header: "状態",
          toValue: (delivery) => statusLabels[delivery.status] ?? delivery.status,
        },
        {
          header: "試行回数",
          toValue: (delivery) => `${delivery.attempt} / ${delivery.max_attempts}`,
        },
        { header: "実行予定日時", toValue: (delivery) => formatDateTime(delivery.available_at) },
        {
          header: "処理期限",
          toValue: (delivery) => formatDateTime(delivery.lease_expires_at),
        },
        {
          header: "直近のエラー",
          toValue: (delivery) => delivery.last_error_code ?? "-",
        },
        { header: "完了日時", toValue: (delivery) => formatDateTime(delivery.completed_at) },
      ]}
    />
  )
}
