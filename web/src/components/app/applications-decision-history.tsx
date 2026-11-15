import type { ApplicationDecision } from "@/components/app/application-types"
import { formatDate } from "@/components/app/data-view"
import {
  Timeline,
  TimelineConnector,
  TimelineDescription,
  TimelineItem,
  TimelineMarker,
  TimelineTime,
  TimelineTitle,
} from "@/components/ui/timeline"

const ACTION_TEXT: Readonly<Record<ApplicationDecision["action"], string>> = {
  approve: "承認",
  reject: "却下",
  return: "差し戻し",
}

/** 判断した人と判断の内容を一文にする。代理の判断は、誰の代わりかも付ける。 */
function describeDecision(decision: ApplicationDecision): string {
  const represented =
    decision.represented_approver_name !== "" &&
    decision.represented_approver_name !== decision.approver_name
      ? `（${decision.represented_approver_name} の代理）`
      : ""
  return `${decision.approver_name} が${ACTION_TEXT[decision.action]}${represented}`
}

/** 申請にこれまでされた判断を、古い順に並べる。 */
export function DecisionHistory(props: { approvals: ReadonlyArray<ApplicationDecision> }) {
  if (props.approvals.length === 0) return null

  return (
    <Timeline aria-label="これまでの判断">
      {props.approvals.map((decision) => (
        <TimelineItem key={decision.id} value={String(decision.id)}>
          <TimelineMarker />
          <TimelineConnector />
          <TimelineTitle>{describeDecision(decision)}</TimelineTitle>
          <TimelineTime dateTime={decision.created_at}>
            {formatDate(decision.created_at)}
          </TimelineTime>
          {decision.comment !== null && decision.comment !== "" && (
            <TimelineDescription className="whitespace-pre-wrap text-foreground">
              {decision.comment}
            </TimelineDescription>
          )}
        </TimelineItem>
      ))}
    </Timeline>
  )
}
