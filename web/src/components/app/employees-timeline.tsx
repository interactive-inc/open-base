import { CheckIcon } from "lucide-react"
import { Link } from "@void/react"
import type { ComponentProps } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Timeline,
  TimelineConnector,
  TimelineDescription,
  TimelineItem,
  TimelineMarker,
  TimelineTime,
  TimelineTitle,
} from "@/components/ui/timeline"
import { EventStatusLabel } from "@/components/app/employees-status"
import {
  describeSummary,
  formatCalendarDate,
  KIND_TEXT,
  type LifecycleEvent,
} from "@/components/app/employees-types"

/** 基準日から見た発令の位置。済み・いまここ・これから。 */
type Place = NonNullable<ComponentProps<typeof TimelineItem>["status"]>

const SOURCE_TEXT: Readonly<Record<LifecycleEvent["source_type"], string>> = {
  application: "申請から確定",
  direct: "直接確定",
  system: "取り込み",
}

/**
 * 基準日から見た各発令の位置。
 * 基準日より後は「これから」、基準日までで最も新しい有効な発令を「いまここ」、それより前を「済み」にする。
 * 訂正された元の発令は効力が無いので「いまここ」にしない。
 */
export function placeEvents(
  events: ReadonlyArray<LifecycleEvent>,
  asOf: string,
): ReadonlyMap<string, Place> {
  const places = new Map<string, Place>()
  let currentFound = false
  for (const event of events) {
    if (event.event_on > asOf) {
      places.set(event.id, "upcoming")
    } else if (!currentFound && event.display_status !== "corrected") {
      places.set(event.id, "current")
      currentFound = true
    } else {
      places.set(event.id, "complete")
    }
  }
  return places
}

/**
 * ひとりの人事発令を、新しい順の時系列で見せる。
 * 予定は上に、基準日現在の発令に「いまここ」を付ける。訂正された発令は打ち消し線で残す。
 */
export function LifecycleTimeline(props: {
  events: ReadonlyArray<LifecycleEvent>
  asOf: string
  label: string
}) {
  const places = placeEvents(props.events, props.asOf)

  return (
    <Timeline aria-label={props.label}>
      {props.events.map((event) => {
        const place = places.get(event.id) ?? "complete"
        const corrected = event.display_status === "corrected"
        const detail = describeSummary(event.summary)
        return (
          <TimelineItem key={event.id} value={event.id} status={place}>
            <TimelineMarker>
              {place === "complete" && !corrected && <CheckIcon aria-hidden="true" />}
            </TimelineMarker>
            <TimelineConnector />
            <TimelineTitle className="flex flex-wrap items-center gap-2">
              <span className={corrected ? "line-through" : undefined}>
                {KIND_TEXT[event.kind]}
              </span>
              {place === "current" && <Badge>いまここ</Badge>}
              <EventStatusLabel status={event.display_status} />
            </TimelineTitle>
            <TimelineTime dateTime={event.event_on}>
              {formatCalendarDate(event.event_on)}
            </TimelineTime>
            <TimelineDescription className="flex flex-col gap-1">
              {detail !== "" && (
                <span className={corrected ? "line-through" : "text-foreground"}>{detail}</span>
              )}
              <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <span>{SOURCE_TEXT[event.source_type]}</span>
                {event.source_application_id !== null && (
                  <Link href={`/applications/${event.source_application_id}`}>
                    申請番号 {event.source_application_id}
                  </Link>
                )}
              </span>
            </TimelineDescription>
          </TimelineItem>
        )
      })}
    </Timeline>
  )
}
