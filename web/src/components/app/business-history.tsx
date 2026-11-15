import type { ReactNode } from "react"
import { formatDateTime } from "@/components/app/business-types"
import {
  Timeline,
  TimelineConnector,
  TimelineDescription,
  TimelineItem,
  TimelineMarker,
  TimelineTime,
  TimelineTitle,
} from "@/components/ui/timeline"

export type HistoryEntry = {
  revision: number
  recorded_at: string
  reason: string
  /** その版で何がどうなっていたかの短い説明。 */
  summary: ReactNode
}

/** 記録の版の並び。新しい版から順に、いつ、何を、なぜ変えたかを見せる。 */
export function RevisionHistory({ entries }: { entries: ReadonlyArray<HistoryEntry> }) {
  if (entries.length === 0) {
    return <p className="text-sm">変更の履歴はまだありません。</p>
  }
  const sorted = [...entries].sort((a, b) => b.revision - a.revision)

  return (
    <Timeline aria-label="変更の履歴">
      {sorted.map((entry) => (
        <TimelineItem key={entry.revision}>
          <TimelineMarker />
          <TimelineConnector />
          <TimelineTitle>{entry.summary}</TimelineTitle>
          <TimelineTime dateTime={entry.recorded_at}>
            第{entry.revision}版 · {formatDateTime(entry.recorded_at)}
          </TimelineTime>
          {entry.reason !== "" && (
            <TimelineDescription className="whitespace-pre-wrap">
              理由: {entry.reason}
            </TimelineDescription>
          )}
        </TimelineItem>
      ))}
    </Timeline>
  )
}
