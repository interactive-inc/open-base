import { CheckIcon, Undo2Icon, XIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Timeline,
  TimelineConnector,
  TimelineDescription,
  TimelineItem,
  TimelineMarker,
  TimelineTitle,
} from "@/components/ui/timeline"

export type PhaseStatus = "waiting" | "pending" | "approved" | "rejected" | "returned"

export type Phase = { key: string; name: string; status: PhaseStatus }

/** 段階の状態を、Timelineの済み・いま・これからに当てる。止められた段階は、そこで止まった今の段階とする。 */
const TIMELINE_STATUS: Readonly<Record<PhaseStatus, "complete" | "current" | "upcoming">> = {
  waiting: "upcoming",
  pending: "current",
  approved: "complete",
  rejected: "current",
  returned: "current",
}

const STATUS_TEXT: Readonly<Record<PhaseStatus, string>> = {
  waiting: "これから",
  pending: "いまここ",
  approved: "済み",
  rejected: "却下",
  returned: "差し戻し",
}

function PhaseMarker({ status }: { status: PhaseStatus }) {
  if (status === "approved") {
    return (
      <TimelineMarker>
        <CheckIcon aria-hidden="true" />
      </TimelineMarker>
    )
  }
  if (status === "rejected" || status === "returned") {
    const Icon = status === "rejected" ? XIcon : Undo2Icon
    return (
      <TimelineMarker className="border-destructive text-destructive">
        <Icon aria-hidden="true" />
      </TimelineMarker>
    )
  }
  return <TimelineMarker />
}

/**
 * 手続きの段階を横一列のTimelineで見せる。
 *
 * 済んだ段階に印、今いる段階は主の色の縁、止められた段階は警告の色の印を付ける。
 * 色だけに頼らないよう、段階の名前の下に状態を文字でも出す。
 */
export function PhaseBar({ phases, label }: { phases: ReadonlyArray<Phase>; label: string }) {
  if (phases.length === 0) return null

  return (
    <Timeline aria-label={label} orientation="horizontal">
      {phases.map((phase) => (
        <TimelineItem key={phase.key} value={phase.key} status={TIMELINE_STATUS[phase.status]}>
          <PhaseMarker status={phase.status} />
          <TimelineConnector />
          <TimelineTitle>{phase.name}</TimelineTitle>
          <TimelineDescription>{STATUS_TEXT[phase.status]}</TimelineDescription>
        </TimelineItem>
      ))}
    </Timeline>
  )
}

export type ApplicationStatus = "pending" | "approved" | "rejected"

const APPLICATION_STATUS: Readonly<
  Record<ApplicationStatus, { text: string; variant: "secondary" | "outline" | "destructive" }>
> = {
  pending: { text: "承認待ち", variant: "secondary" },
  approved: { text: "承認済み", variant: "outline" },
  rejected: { text: "却下", variant: "destructive" },
}

/** 申請の状態を短い札で見せる。 */
export function ApplicationStatusLabel({ status }: { status: ApplicationStatus }) {
  const item = APPLICATION_STATUS[status]

  return <Badge variant={item.variant}>{item.text}</Badge>
}
