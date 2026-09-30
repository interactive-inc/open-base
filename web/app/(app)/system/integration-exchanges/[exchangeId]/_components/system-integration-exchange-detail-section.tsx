import Link from "next/link"
import { toConnectorDirectionLabel } from "@/app/(app)/system/connectors/_lib/to-connector-direction-label"
import { toExchangeStatusLabel } from "@/app/(app)/system/integration-exchanges/_lib/to-exchange-status-label"
import { FetchError } from "@/components/fetch-error"
import { getSystemIntegrationExchange } from "@/lib/api/get-system-integration-exchange"

type Props = {
  exchangeId: string
}

/** 1 件の外部交換の属性を読み取り専用で並べる。 */
export async function SystemIntegrationExchangeDetailSection(props: Props) {
  const exchange = await getSystemIntegrationExchange(props.exchangeId)

  if (exchange instanceof Error) {
    return <FetchError message="外部交換の取得に失敗しました" />
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-mono text-lg font-semibold">{exchange.operationKey}</h2>

      <dl className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">識別子</dt>

          <dd className="font-mono text-xs">{exchange.id}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">コネクタ</dt>

          <dd className="font-mono text-xs">
            <Link className="underline" href={`/system/connectors/${exchange.connectorId}`}>
              {exchange.connectorId}
            </Link>
          </dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">向き</dt>

          <dd className="text-sm">{toConnectorDirectionLabel(exchange.direction)}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">状態</dt>

          <dd className="text-sm">{toExchangeStatusLabel(exchange.status)}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">試行</dt>

          <dd className="text-sm">{exchange.attempt}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">冪等キー</dt>

          <dd className="font-mono text-xs break-all">{exchange.idempotencyKey}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">payload の digest</dt>

          <dd className="font-mono text-xs break-all">{exchange.payloadDigest}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">外部の参照</dt>

          <dd className="text-sm break-all">{exchange.externalReference ?? "-"}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">直近のエラー</dt>

          <dd className="font-mono text-xs">{exchange.lastErrorCode ?? "-"}</dd>
        </div>
      </dl>
    </section>
  )
}
