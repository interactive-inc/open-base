import { formatEpochMilliseconds } from "@/app/(app)/system/integration-exchanges/[exchangeId]/_lib/format-epoch-milliseconds"
import { FetchError } from "@/components/fetch-error"
import { SystemResourceTable } from "@/components/system-resource-table"
import { getSystemReconciliationRuns } from "@/lib/api/get-system-reconciliation-runs"

type Props = {
  exchangeId: string
}

/**
 * 外部交換の照合実行を読み取り専用で並べる。
 * api は item を内部結合で数えるので、item が 1 件も無い実行はここに出ない。
 */
export async function SystemReconciliationSection(props: Props) {
  const runs = await getSystemReconciliationRuns(props.exchangeId)

  if (runs instanceof Error) {
    return <FetchError message="照合の取得に失敗しました" />
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">照合</h2>

      <SystemResourceTable
        caption="照合の一覧"
        resources={runs}
        toKey={(run) => run.id}
        emptyTitle="照合がありません"
        emptyDescription="この交換ではまだ照合が記録されていません。"
        columns={[
          {
            header: "識別子",
            toValue: (run) => <span className="font-mono text-xs">{run.id}</span>,
          },
          { header: "状態", toValue: (run) => run.status },
          {
            header: "外部の主張",
            toValue: (run) => <span className="font-mono text-xs">{run.assertion_id}</span>,
          },
          { header: "こちらの版", toValue: (run) => run.local_version },
          { header: "項目数", toValue: (run) => run.item_count },
          {
            header: "記録",
            toValue: (run) => formatEpochMilliseconds(run.created_at),
          },
        ]}
      />
    </section>
  )
}
