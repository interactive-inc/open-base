import { FileClock } from "lucide-react"
import Link from "next/link"
import { auditActionLabel } from "@/app/(app)/system/audit-events/_lib/audit-action-label"
import { auditClientLabel } from "@/app/(app)/system/audit-events/_lib/audit-client-label"
import { auditOutcomeLabel } from "@/app/(app)/system/audit-events/_lib/audit-outcome-label"
import { auditReasonLabel } from "@/app/(app)/system/audit-events/_lib/audit-reason-label"
import { auditTargetTypeLabel } from "@/app/(app)/system/audit-events/_lib/audit-target-type-label"
import { formatAuditDateTime } from "@/app/(app)/system/audit-events/_lib/format-audit-date-time"
import { StatusLabel } from "@/components/status-label"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AuditEventSummary } from "@/lib/api/types/audit-types"

type Props = {
  events: ReadonlyArray<AuditEventSummary>
}

function actorLabel(event: AuditEventSummary): string {
  if (event.actor_account_id === null && event.actor_employee_id === null) return "未認証"
  return `account:${event.actor_account_id ?? "—"} / employee:${event.actor_employee_id ?? "—"}`
}

const outcomeVariant = {
  succeeded: "secondary",
  denied: "secondary",
  failed: "destructive",
} as const

export function AuditEventTable(props: Props) {
  if (props.events.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileClock aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>該当する監査ログはありません</EmptyTitle>
          <EmptyDescription>条件を変更して、もう一度検索してください。</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Table aria-label="監査ログ一覧">
      <TableHeader>
        <TableRow>
          <TableHead>発生日時</TableHead>
          <TableHead>操作</TableHead>
          <TableHead>結果</TableHead>
          <TableHead>実行者</TableHead>
          <TableHead>対象</TableHead>
          <TableHead>理由</TableHead>
          <TableHead className="hidden xl:table-cell">クライアント / リクエスト</TableHead>
          <TableHead>詳細</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.events.map((event) => (
          <TableRow key={event.event_id}>
            <TableCell>
              <time dateTime={event.created_at} title={event.created_at} className="tabular-nums">
                {formatAuditDateTime(event.created_at)}
              </time>
            </TableCell>
            <TableCell className="whitespace-normal">
              <div className="flex min-w-0 flex-col gap-2">
                <span className="break-words">{auditActionLabel(event.action)}</span>
                <code className="break-all text-xs text-muted-foreground" translate="no">
                  {event.event_id}
                </code>
              </div>
            </TableCell>
            <TableCell>
              <StatusLabel variant={outcomeVariant[event.outcome]}>
                {auditOutcomeLabel(event.outcome)}
              </StatusLabel>
            </TableCell>
            <TableCell translate="no">{actorLabel(event)}</TableCell>
            <TableCell className="whitespace-normal">
              <span>{auditTargetTypeLabel(event.target_type)}</span>
              {event.target_id === null ? null : (
                <code className="block break-all text-xs text-muted-foreground" translate="no">
                  {event.target_id}
                </code>
              )}
            </TableCell>
            <TableCell className="whitespace-normal break-words">
              {auditReasonLabel(event.reason_code)}
            </TableCell>
            <TableCell className="hidden xl:table-cell">
              <span>{auditClientLabel(event.client_name)}</span>
              <code className="block font-mono text-xs text-muted-foreground" translate="no">
                {event.request_id}
              </code>
            </TableCell>
            <TableCell>
              <Button
                variant="secondary"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    href={`/system/audit-events/${encodeURIComponent(event.event_id)}`}
                    prefetch={false}
                    aria-label={`監査イベント ${event.event_id} の詳細`}
                  />
                }
              >
                詳細
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
