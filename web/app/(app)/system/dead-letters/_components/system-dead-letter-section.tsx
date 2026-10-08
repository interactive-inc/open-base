import { FetchError } from "@/components/fetch-error"
import { SystemResourceTable } from "@/components/system-resource-table"
import { getSystemDeadLetters } from "@/lib/api/get-system-dead-letters"
import { formatDateTime } from "@/lib/format-date-time"

const sourceTypeLabels: Record<string, string> = {
  job: "ジョブ",
  outbox: "送信箱",
  inbox: "受信箱",
}

/**
 * dead letter を読み取り専用で並べる。再投入は API と CLI が持つので導線は置かない。
 */
export async function SystemDeadLetterSection() {
  const deadLetters = await getSystemDeadLetters()

  if (deadLetters instanceof Error) {
    return <FetchError message="配信不能の一覧を読み込めませんでした。" />
  }

  return (
    <SystemResourceTable
      caption="配信不能の一覧"
      resources={deadLetters}
      toKey={(deadLetter) => deadLetter.id}
      emptyTitle="配信不能はありません"
      emptyDescription="再試行の上限に達した配信はありません。"
      columns={[
        {
          header: "発生元",
          toValue: (deadLetter) => sourceTypeLabels[deadLetter.sourceType] ?? deadLetter.sourceType,
        },
        {
          header: "発生元ID",
          toValue: (deadLetter) => <span className="font-mono text-xs">{deadLetter.sourceId}</span>,
        },
        {
          header: "理由",
          toValue: (deadLetter) => (
            <span className="font-mono text-xs">{deadLetter.reasonCode}</span>
          ),
        },
        { header: "試行回数", toValue: (deadLetter) => deadLetter.attempt },
        { header: "記録日時", toValue: (deadLetter) => formatDateTime(deadLetter.recordedAt) },
        {
          header: "再実行",
          toValue: (deadLetter) => {
            if (deadLetter.requeuedAt === null) return "未実行"

            return formatDateTime(deadLetter.requeuedAt)
          },
        },
      ]}
    />
  )
}
