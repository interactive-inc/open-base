import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { buildAuditEventsHref } from "@/app/(app)/system/audit-events/_lib/build-audit-events-href"
import { Button } from "@/components/ui/button"
import type { AuditListQuery } from "@/lib/api/types/audit-types"

type Props = {
  query: AuditListQuery
  previousCursor: string | null
  nextCursor: string | null
}

function DisabledDirection(props: { direction: "previous" | "next" }) {
  const previous = props.direction === "previous"
  return (
    <span
      aria-disabled="true"
      className="inline-flex h-9 items-center gap-2 rounded-4xl px-4 text-sm text-muted-foreground"
    >
      {previous ? <ChevronLeft aria-hidden="true" /> : null}
      {previous ? "前のページ" : "次のページ"}
      {previous ? null : <ChevronRight aria-hidden="true" />}
    </span>
  )
}

export function AuditCursorPagination(props: Props) {
  return (
    <nav aria-label="監査ログのページ送り" className="flex items-center justify-between gap-4">
      {props.previousCursor === null ? (
        <DisabledDirection direction="previous" />
      ) : (
        <Button
          variant="secondary"
          nativeButton={false}
          render={
            <Link href={buildAuditEventsHref(props.query, props.previousCursor)} prefetch={false} />
          }
        >
          <ChevronLeft data-icon="inline-start" aria-hidden="true" />
          前のページ
        </Button>
      )}

      {props.nextCursor === null ? (
        <DisabledDirection direction="next" />
      ) : (
        <Button
          variant="secondary"
          nativeButton={false}
          render={
            <Link href={buildAuditEventsHref(props.query, props.nextCursor)} prefetch={false} />
          }
        >
          次のページ
          <ChevronRight data-icon="inline-end" aria-hidden="true" />
        </Button>
      )}
    </nav>
  )
}
