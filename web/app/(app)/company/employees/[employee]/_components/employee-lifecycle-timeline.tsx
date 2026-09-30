import { formatLifecycleDate } from "@/app/(app)/company/employees/[employee]/_lib/format-lifecycle-date"
import { TextLink } from "@/components/text-link"
import { formatLifecycleDisplayStatus } from "@/app/(app)/company/employees/[employee]/_lib/format-lifecycle-display-status"
import { formatLifecycleKind } from "@/app/(app)/company/_lib/format-lifecycle-kind"
import { summarizeLifecycleEvent } from "@/app/(app)/company/_lib/summarize-lifecycle-event"
import { StatusLabel } from "@/components/status-label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import type { EmployeeLifecycleEvents } from "@/lib/api/get-employee-lifecycle-events"

export function EmployeeLifecycleTimeline(props: {
  code: string
  events: EmployeeLifecycleEvents
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>人材タイムライン</CardTitle>
        <CardDescription>入社から配属、異動、休復職、退職までの確定履歴</CardDescription>
      </CardHeader>
      <CardContent>
        {props.events.data.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>人事発令はまだありません</EmptyTitle>
              <EmptyDescription>確定した発令がここへ時系列で表示されます。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ol className="flex flex-col gap-4" aria-label="確定した人事発令">
            {props.events.data.map((event) => {
              const details = summarizeLifecycleEvent(event.summary)
              return (
                <li key={event.id} className="min-w-0 rounded-xl bg-card border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium break-words">{formatLifecycleKind(event.kind)}</p>
                      <p className="text-sm text-muted-foreground">
                        <time dateTime={event.event_on}>{formatLifecycleDate(event.event_on)}</time>
                      </p>
                    </div>
                    <StatusLabel>{formatLifecycleDisplayStatus(event.display_status)}</StatusLabel>
                  </div>
                  {details.length > 0 ? (
                    <ul className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
                      {details.map((detail) => (
                        <li key={detail} className="break-words">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ol>
        )}
        {props.events.next_cursor !== null ? (
          <div className="mt-4">
            <TextLink
              href={`/company/employees/${encodeURIComponent(props.code)}/timeline?cursor=${encodeURIComponent(props.events.next_cursor)}`}
              prefetch={false}
              className="font-medium"
            >
              さらに履歴を表示
            </TextLink>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
