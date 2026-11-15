import { formatDate } from "@/components/app/data-view"
import { operationText, STATUS_TEXT } from "@/components/app/reviews-model"
import type { ReviewHistoryEntry } from "@/components/app/reviews-types"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Timeline,
  TimelineConnector,
  TimelineDescription,
  TimelineItem,
  TimelineMarker,
  TimelineTime,
  TimelineTitle,
} from "@/components/ui/timeline"

/**
 * 版の履歴。版ごとに、誰が何をして、どの状態になったかと理由を新しい順に出す。
 * 操作した人の名前は評価のAPIから読めないので、本人かそれ以外かだけを出す。
 */
export function ReviewHistory(props: {
  entries: ReadonlyArray<ReviewHistoryEntry>
  ownerAccountId: string
  /** まだ読んでいない古い版があるとき。 */
  truncated: boolean
}) {
  const entries = [...props.entries].reverse()

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>版の履歴</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p>まだ履歴がありません。</p>
        ) : (
          <Timeline aria-label="版の履歴">
            {entries.map((entry) => (
              <TimelineItem key={entry.revision} value={String(entry.revision)}>
                <TimelineMarker />
                <TimelineConnector />
                <TimelineTitle>{operationText(entry)}</TimelineTitle>
                <TimelineTime dateTime={entry.created_at}>
                  <span>版 {entry.revision}</span> ·{" "}
                  {entry.actor_account_id === props.ownerAccountId ? "本人" : "評価者など"} ·{" "}
                  {formatDate(entry.created_at)} · {STATUS_TEXT[entry.snapshot.status]}
                </TimelineTime>
                <TimelineDescription className="break-words whitespace-pre-wrap text-foreground">
                  {entry.reason}
                </TimelineDescription>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </CardContent>
      {props.truncated && (
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            古い版から100件までを読み込んでいます。それより新しい版はCLIかAPIで確かめてください。
          </p>
        </CardFooter>
      )}
    </Card>
  )
}
