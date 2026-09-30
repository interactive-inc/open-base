import Link from "next/link"
import { notFound } from "next/navigation"
import { AuditCursorPagination } from "@/app/(app)/system/audit-events/_components/audit-cursor-pagination"
import { AuditEventTable } from "@/app/(app)/system/audit-events/_components/audit-event-table"
import { buildAuditEventsHref } from "@/app/(app)/system/audit-events/_lib/build-audit-events-href"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ApiResponseError } from "@/lib/api/api-response-error"
import { AuthError } from "@/lib/api/auth-error"
import { getAuditEvents } from "@/lib/api/get-audit-events"
import type { AuditListQuery } from "@/lib/api/types/audit-types"

type Props = {
  query: AuditListQuery
}

export async function AuditEventListSection(props: Props) {
  const result = await getAuditEvents(props.query)

  if (result instanceof Error) {
    if (result instanceof ApiResponseError && result.status === 401) throw new AuthError()
    if (result instanceof ApiResponseError && result.status === 403) notFound()

    if (result instanceof ApiResponseError && result.code === "invalid_audit_cursor") {
      return (
        <Alert>
          <AlertTitle>ページ情報が無効です</AlertTitle>
          <AlertDescription>
            URLのページ情報が期限切れか変更されています。{" "}
            <Link href={buildAuditEventsHref(props.query, null)} prefetch={false}>
              先頭から表示
            </Link>
          </AlertDescription>
        </Alert>
      )
    }

    return (
      <Alert variant="destructive">
        <AlertTitle>監査ログを取得できませんでした</AlertTitle>
        <AlertDescription>時間をおいて、もう一度お試しください。</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">このページに {result.data.length} 件</p>
      <AuditEventTable events={result.data} />
      <AuditCursorPagination
        query={props.query}
        previousCursor={result.previous_cursor}
        nextCursor={result.next_cursor}
      />
    </div>
  )
}
